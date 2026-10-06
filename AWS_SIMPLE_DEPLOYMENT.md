# AWS 单服务器部署（最省钱方案）

## 💰 架构：全部在一台 EC2 上

```
┌─────────────────────────────────┐
│      Route 53 (DNS)              │
│      winaii.com                  │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│    EC2 Instance (t2.micro)        │
│    ┌──────────────────────────┐  │
│    │      Nginx 反向代理       │  │
│    │  :80/:443 (HTTPS)        │  │
│    └────┬─────────────┬────────┘  │
│         │             │           │
│    ┌────▼────┐   ┌───▼────────┐  │
│    │ 前端静态 │   │  Node.js    │  │
│    │  /var/  │   │  :3000      │  │
│    │  www    │   │  (Express)  │  │
│    └─────────┘   └──────┬──────┘  │
│                         │          │
│                   ┌─────▼──────┐   │
│                   │ PostgreSQL │   │
│                   │ localhost  │   │
│                   └────────────┘   │
└──────────────────────────────────┘
```

**月成本**：~$8-12（仅 EC2 + 小量流量）

---

## 🚀 快速部署步骤

### Step 1: 创建 EC2 实例

1. **AMI**：Ubuntu Server 22.04 LTS
2. **实例类型**：t2.micro
3. **安全组规则**：
   - SSH (22) - 你的 IP
   - HTTP (80) - 0.0.0.0/0
   - HTTPS (443) - 0.0.0.0/0
4. **存储**：16 GB gp3（稍大一点存照片）
5. **下载密钥对**：`winaii-key.pem`

### Step 2: 连接到服务器

```bash
chmod 400 winaii-key.pem
ssh -i winaii-key.pem ubuntu@<EC2-公网-IP>
```

### Step 3: 一键安装脚本

在 EC2 上创建并运行安装脚本：

```bash
# 创建安装脚本
nano install.sh
```

复制以下内容：

```bash
#!/bin/bash
set -e

echo "================================"
echo "  安装 winaii.com 工地管理系统"
echo "================================"

# 更新系统
echo "1. 更新系统..."
sudo apt update && sudo apt upgrade -y

# 安装 Node.js
echo "2. 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装其他工具
echo "3. 安装工具..."
sudo apt install -y git nginx postgresql postgresql-contrib certbot python3-certbot-nginx

# 安装 PM2
echo "4. 安装 PM2..."
sudo npm install -g pm2

# 启动 PostgreSQL
echo "5. 启动 PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建目录
echo "6. 创建项目目录..."
sudo mkdir -p /var/www/winaii.com
sudo mkdir -p /var/www/uploads
sudo chown -R ubuntu:ubuntu /var/www

echo "================================"
echo "  基础环境安装完成！"
echo "================================"
echo ""
echo "接下来请执行："
echo "1. 配置数据库"
echo "2. 上传项目文件"
echo "3. 配置 Nginx"
echo "4. 申请 SSL 证书"
```

运行脚本：

```bash
chmod +x install.sh
./install.sh
```

### Step 4: 配置数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 执行以下 SQL：
CREATE DATABASE construction_simple;
CREATE USER construction_user WITH PASSWORD 'Change_Me_123!@#';
GRANT ALL PRIVILEGES ON DATABASE construction_simple TO construction_user;
ALTER DATABASE construction_simple OWNER TO construction_user;
\q
```

### Step 5: 上传项目文件

**在你的本地电脑上**执行：

```bash
# 1. 构建前端
cd frontend-mobile
npm install
npm run build:h5

# 2. 打包前端
cd dist/build/h5
tar -czf frontend.tar.gz *

# 3. 打包后端
cd ../../../..
cd backend
npm install --production
tar -czf backend.tar.gz *

# 4. 上传到服务器（替换 EC2-IP 和 密钥路径）
scp -i winaii-key.pem frontend-mobile/dist/build/h5/frontend.tar.gz ubuntu@<EC2-IP>:~/
scp -i winaii-key.pem backend/backend.tar.gz ubuntu@<EC2-IP>:~/
scp -i winaii-key.pem docs/simple-database-schema.sql ubuntu@<EC2-IP>:~/
```

**回到 EC2 服务器**：

```bash
# 解压前端到 Nginx 目录
cd /var/www/winaii.com
tar -xzf ~/frontend.tar.gz

# 解压后端
mkdir -p ~/backend
cd ~/backend
tar -xzf ~/backend.tar.gz

# 导入数据库
psql -U construction_user -d construction_simple -f ~/simple-database-schema.sql
# 输入密码：Change_Me_123!@#
```

### Step 6: 配置后端环境变量

```bash
cd ~/backend
nano .env
```

输入：

```bash
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_simple
DB_USER=construction_user
DB_PASSWORD=Change_Me_123!@#

JWT_SECRET=aB3$xY9#mK2@pL7!qR4&sT8%uV6^wZ1*
JWT_EXPIRES_IN=7d

UPLOAD_DIR=/var/www/uploads
MAX_FILE_SIZE=10485760
MAX_FILES=10
```

保存退出。

### Step 7: 启动后端

```bash
cd ~/backend
pm2 start src/server.js --name construction-api --max-memory-restart 768M
pm2 save
pm2 startup  # 按提示执行输出的命令
```

### Step 8: 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/winaii
```

输入以下配置：

```nginx
server {
    listen 80;
    server_name winaii.com www.winaii.com;

    # 前端静态文件
    root /var/www/winaii.com;
    index index.html;

    # 上传文件大小限制
    client_max_body_size 10M;

    # 前端路由（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
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
    }

    # 上传文件访问
    location /uploads/ {
        alias /var/www/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

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

### Step 9: 配置域名解析

在 **Route 53**（或你的域名注册商）添加 A 记录：

```
类型: A
名称: @（或 winaii.com）
值: <EC2 公网 IP>
TTL: 300

类型: A
名称: www
值: <EC2 公网 IP>
TTL: 300
```

等待 DNS 生效（5-30分钟）。

### Step 10: 申请 SSL 证书

```bash
# 申请免费 SSL 证书（Let's Encrypt）
sudo certbot --nginx -d winaii.com -d www.winaii.com

# 按提示输入邮箱
# 选择：是否重定向 HTTP 到 HTTPS？ 选择 2（重定向）

# 测试自动续期
sudo certbot renew --dry-run
```

---

## ✅ 验证部署

### 1. 测试 HTTPS

访问：`https://winaii.com`

应该看到登录页面，且地址栏显示🔒。

### 2. 测试 API

打开浏览器控制台（F12），登录系统，查看 Network 标签：
- 请求应该发送到 `https://winaii.com/api/`
- 状态码 200
- 无 CORS 错误

### 3. 测试上传

登录后尝试工序打卡，上传照片，确保：
- 照片能正常上传
- 水印正确添加
- 老板能看到照片

---

## 📊 日常管理命令

### 查看服务状态

```bash
# 后端状态
pm2 status

# 后端日志
pm2 logs construction-api

# Nginx 状态
sudo systemctl status nginx

# 数据库状态
sudo systemctl status postgresql
```

### 重启服务

```bash
# 重启后端
pm2 restart construction-api

# 重启 Nginx
sudo systemctl restart nginx

# 重启数据库
sudo systemctl restart postgresql
```

### 更新前端

```bash
# 本地构建
cd frontend-mobile
npm run build:h5

# 上传
scp -i winaii-key.pem -r dist/build/h5/* ubuntu@<EC2-IP>:/var/www/winaii.com/
```

### 更新后端

```bash
# 上传新代码
scp -i winaii-key.pem -r backend/* ubuntu@<EC2-IP>:~/backend/

# SSH 到服务器
ssh -i winaii-key.pem ubuntu@<EC2-IP>

# 重启服务
cd ~/backend
npm install --production
pm2 restart construction-api
```

### 备份数据库

```bash
# 手动备份
pg_dump -U construction_user construction_simple > backup_$(date +%Y%m%d).sql

# 下载到本地
scp -i winaii-key.pem ubuntu@<EC2-IP>:~/backup_*.sql ./
```

---

## 🔧 故障排查

### 前端显示空白

1. 检查 Nginx 配置：`sudo nginx -t`
2. 检查文件权限：`ls -la /var/www/winaii.com`
3. 查看 Nginx 错误日志：`sudo tail -f /var/log/nginx/error.log`

### API 连接失败

1. 检查后端状态：`pm2 status`
2. 检查端口：`netstat -tlnp | grep 3000`
3. 查看后端日志：`pm2 logs construction-api`
4. 测试本地 API：`curl http://localhost:3000/api/health`

### 照片上传失败

1. 检查上传目录：`ls -la /var/www/uploads`
2. 检查权限：`sudo chown -R ubuntu:ubuntu /var/www/uploads`
3. 检查 Nginx 配置的 `client_max_body_size`

---

## 💾 数据库管理

### 连接数据库

```bash
psql -U construction_user -d construction_simple
```

### 常用查询

```sql
-- 查看所有表
\dt

-- 查看用户数量
SELECT COUNT(*) FROM users;

-- 查看待审批数量
SELECT COUNT(*) FROM node_records WHERE status = 'pending';

-- 退出
\q
```

---

## 📱 访问地址

- **前端**：https://winaii.com
- **API**：https://winaii.com/api
- **上传文件**：https://winaii.com/uploads/

---

## 💰 成本估算

- **EC2 t2.micro**：~$8-10/月（或免费套餐首年）
- **Route 53 托管区域**：$0.50/月
- **数据传输**：前 1GB 免费，之后 ~$0.09/GB
- **存储**：16GB EBS ~$1.6/月

**总计**：~$10-12/月（或首年免费）

---

**优点**：
✅ 成本最低
✅ 配置简单
✅ 维护方便

**缺点**：
⚠️ 单点故障（服务器挂了全挂）
⚠️ 性能有限（t2.micro 1GB RAM）
⚠️ 需手动备份

**适合场景**：
- 小规模使用（20人以内）
- 预算有限
- 短期测试/MVP

---

**最后更新**：2024-10-06
