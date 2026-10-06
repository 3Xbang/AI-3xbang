# 部署到 AWS - winaii.com

## 📋 你的服务器信息

- **弹性IP**：`18.206.11.7`
- **密钥文件**：`D:\下载\3xbang.pem`
- **域名**：`winaii.com`
- **SSH 用户**：`ubuntu`（如果是 Amazon Linux 则是 `ec2-user`）

---

## 🚀 第一步：连接到服务器

打开 PowerShell（Windows）或终端（Mac/Linux）：

```powershell
# Windows PowerShell
cd D:\下载
ssh -i 3xbang.pem ubuntu@18.206.11.7
```

如果提示权限错误，右键 `3xbang.pem` → 属性 → 安全 → 高级，移除所有继承权限，只保留当前用户的读取权限。

**第一次连接时**会提示：
```
Are you sure you want to continue connecting (yes/no)?
```
输入 `yes` 回车。

---

## 🛠️ 第二步：在服务器上安装环境

连接成功后，复制粘贴以下命令（一次一段）：

### 2.1 更新系统并安装基础工具

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git wget unzip
```

### 2.2 安装 Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # 验证，应显示 v18.x.x
```

### 2.3 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.4 安装 PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.5 安装 PM2

```bash
sudo npm install -g pm2
```

### 2.6 创建目录

```bash
sudo mkdir -p /var/www/winaii.com
sudo mkdir -p /var/www/uploads
sudo chown -R ubuntu:ubuntu /var/www
mkdir -p ~/backend
```

---

## 💾 第三步：配置数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql
```

在 PostgreSQL 命令行中执行（复制粘贴）：

```sql
CREATE DATABASE construction_simple;
CREATE USER construction_user WITH PASSWORD 'Winaii2024!@#Strong';
GRANT ALL PRIVILEGES ON DATABASE construction_simple TO construction_user;
ALTER DATABASE construction_simple OWNER TO construction_user;
\q
```

---

## 📦 第四步：上传项目文件

**回到你的本地 Windows 电脑**，打开新的 PowerShell 窗口：

### 4.1 构建前端

```powershell
cd E:\3XBANG\frontend-mobile

# 安装依赖（如果还没安装）
npm install

# 构建生产版本
npm run build:h5
```

### 4.2 上传前端到服务器

```powershell
# 进入构建产物目录
cd dist\build\h5

# 上传所有文件
scp -i "D:\下载\3xbang.pem" -r * ubuntu@18.206.11.7:/var/www/winaii.com/
```

### 4.3 打包并上传后端

```powershell
# 回到项目根目录
cd E:\3XBANG\backend

# 创建临时打包（排除 node_modules）
# 先确保有 .gitignore 或手动排除
tar -czf backend.tar.gz --exclude=node_modules .

# 上传后端
scp -i "D:\下载\3xbang.pem" backend.tar.gz ubuntu@18.206.11.7:~/

# 上传数据库 SQL
cd ..
scp -i "D:\下载\3xbang.pem" docs\simple-database-schema.sql ubuntu@18.206.11.7:~/
```

---

## ⚙️ 第五步：配置并启动后端

**回到服务器的 SSH 连接**：

### 5.1 解压后端

```bash
cd ~/backend
tar -xzf ~/backend.tar.gz
```

### 5.2 安装依赖

```bash
npm install --production
```

### 5.3 导入数据库

```bash
psql -U construction_user -d construction_simple -f ~/simple-database-schema.sql
# 提示输入密码时输入：Winaii2024!@#Strong
```

### 5.4 创建 .env 文件

```bash
nano .env
```

复制粘贴以下内容：

```bash
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_simple
DB_USER=construction_user
DB_PASSWORD=Winaii2024!@#Strong

JWT_SECRET=kL9$mN2@pQ5!rS8#tU1%vW4^xY7&zA3*bC6
JWT_EXPIRES_IN=7d

UPLOAD_DIR=/var/www/uploads
MAX_FILE_SIZE=10485760
MAX_FILES=10
```

按 `Ctrl+O` 保存，`Enter` 确认，`Ctrl+X` 退出。

### 5.5 启动后端服务

```bash
pm2 start src/server.js --name construction-api --max-memory-restart 768M
pm2 save
pm2 startup
# 复制输出的命令并执行（类似：sudo env PATH=...）
```

验证服务运行：

```bash
pm2 status
curl http://localhost:3000/api/auth/health
```

---

## 🌐 第六步：配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/winaii
```

复制粘贴以下配置：

```nginx
server {
    listen 80;
    server_name winaii.com www.winaii.com 18.206.11.7;

    # 前端静态文件
    root /var/www/winaii.com;
    index index.html;

    # 上传文件大小限制
    client_max_body_size 10M;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss;

    # 前端路由（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 上传文件访问
    location /uploads/ {
        alias /var/www/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

保存退出（`Ctrl+O`, `Enter`, `Ctrl+X`）。

启用配置：

```bash
# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 启用新配置
sudo ln -s /etc/nginx/sites-available/winaii /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 🔗 第七步：配置域名解析

### 在 Route 53 或你的域名注册商后台：

1. **添加 A 记录**：
   - 类型：`A`
   - 名称：`@` 或留空（代表 winaii.com）
   - 值：`18.206.11.7`
   - TTL：`300`

2. **添加 www 记录**：
   - 类型：`A`
   - 名称：`www`
   - 值：`18.206.11.7`
   - TTL：`300`

保存后等待 5-30 分钟 DNS 生效。

### 临时测试（无需等待 DNS）

在浏览器访问：`http://18.206.11.7`

应该能看到登录页面！

---

## 🔐 第八步：配置 SSL 证书（HTTPS）

**等 DNS 生效后**（能通过 winaii.com 访问后），在服务器执行：

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d winaii.com -d www.winaii.com
```

按提示操作：
1. 输入邮箱
2. 同意服务条款（输入 `Y`）
3. 是否接收邮件（可选 `N`）
4. **重要**：选择重定向 HTTP 到 HTTPS（输入 `2`）

测试自动续期：

```bash
sudo certbot renew --dry-run
```

---

## ✅ 验证部署

### 1. 测试 HTTP（临时）

```
http://18.206.11.7
```

### 2. 测试域名（DNS 生效后）

```
http://winaii.com
```

### 3. 测试 HTTPS（SSL 配置后）

```
https://winaii.com
```

### 4. 测试 API

打开浏览器控制台（F12）→ Network，登录系统：
- 测试账号：`boss` / `Admin@123`
- 查看请求是否成功

---

## 📊 日常管理

### 查看服务状态

```bash
# SSH 连接
ssh -i "D:\下载\3xbang.pem" ubuntu@18.206.11.7

# 查看后端状态
pm2 status

# 查看日志
pm2 logs construction-api

# 实时日志
pm2 logs construction-api --lines 100
```

### 重启服务

```bash
# 重启后端
pm2 restart construction-api

# 重启 Nginx
sudo systemctl restart nginx
```

### 更新前端

```powershell
# 本地构建
cd E:\3XBANG\frontend-mobile
npm run build:h5

# 上传
cd dist\build\h5
scp -i "D:\下载\3xbang.pem" -r * ubuntu@18.206.11.7:/var/www/winaii.com/
```

### 更新后端

```powershell
# 本地打包
cd E:\3XBANG\backend
tar -czf backend.tar.gz --exclude=node_modules src package.json

# 上传
scp -i "D:\下载\3xbang.pem" backend.tar.gz ubuntu@18.206.11.7:~/backend/
```

然后在服务器：

```bash
cd ~/backend
tar -xzf backend.tar.gz
npm install --production
pm2 restart construction-api
```

### 备份数据库

```bash
# 在服务器上
pg_dump -U construction_user construction_simple > backup_$(date +%Y%m%d_%H%M%S).sql

# 下载到本地
scp -i "D:\下载\3xbang.pem" ubuntu@18.206.11.7:~/backup_*.sql D:\备份\
```

---

## 🔧 故障排查

### 无法访问网站

```bash
# 检查 Nginx
sudo systemctl status nginx
sudo nginx -t

# 检查防火墙（AWS 安全组）
# 确保开放了 80, 443 端口
```

### API 报错

```bash
# 查看后端状态
pm2 status

# 查看日志
pm2 logs construction-api --lines 50

# 重启后端
pm2 restart construction-api
```

### 数据库连接失败

```bash
# 检查数据库状态
sudo systemctl status postgresql

# 测试连接
psql -U construction_user -d construction_simple -c "SELECT 1;"
```

---

## 📱 访问地址

- **临时 IP 访问**：http://18.206.11.7
- **域名访问**：https://winaii.com
- **API 地址**：https://winaii.com/api
- **上传文件**：https://winaii.com/uploads/

---

## 🎯 测试账号

**老板**：
- 用户名：`boss`
- 密码：`Admin@123`

**工人**：
- 用户名：`zhangsan`
- 密码：`Worker@123`

---

## 📞 快速命令参考

```bash
# 连接服务器
ssh -i "D:\下载\3xbang.pem" ubuntu@18.206.11.7

# 查看服务状态
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql

# 查看日志
pm2 logs construction-api
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 重启服务
pm2 restart construction-api
sudo systemctl restart nginx
```

---

## ✨ 下一步

1. ✅ 现在就可以通过 IP 访问：http://18.206.11.7
2. ⏳ 配置域名解析（5-30分钟生效）
3. 🔒 DNS 生效后配置 SSL（5分钟）
4. 🎉 正式上线！

---

**有任何问题，随时问我！**
