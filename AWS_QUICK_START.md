# AWS 快速部署指南 - winaii.com

## 📋 你的服务器配置

| 项目 | 信息 |
|------|------|
| 弹性IP | `18.206.11.7` |
| 密钥文件 | `D:\下载\3xbang.pem` |
| SSH 用户 | `ubuntu` |
| 域名 | `winaii.com` |

---

## 🚀 快速开始

### 方式 1：使用 PowerShell 自动脚本（推荐）

我已经为你创建了 3 个自动化脚本：

#### 1️⃣ 连接到服务器

```powershell
cd E:\3XBANG
.\ssh-connect.ps1
```

#### 2️⃣ 部署前端

```powershell
cd E:\3XBANG
.\deploy-frontend.ps1
```

自动完成：
- ✅ 构建前端
- ✅ 上传到服务器
- ✅ 自动显示访问地址

#### 3️⃣ 部署后端

```powershell
cd E:\3XBANG
.\deploy-backend.ps1
```

自动完成：
- ✅ 打包后端代码
- ✅ 上传到服务器
- ✅ 安装依赖
- ✅ 重启服务

---

### 方式 2：手动命令

如果脚本遇到问题，可以手动执行：

#### 连接服务器

```powershell
ssh -i "D:\下载\3xbang.pem" ubuntu@18.206.11.7
```

#### 部署前端

```powershell
# 构建
cd E:\3XBANG\frontend-mobile
npm run build:h5

# 上传
cd dist\build\h5
scp -i "D:\下载\3xbang.pem" -r * ubuntu@18.206.11.7:/var/www/winaii.com/
```

#### 部署后端

```powershell
# 打包
cd E:\3XBANG\backend
tar -czf backend.tar.gz --exclude=node_modules *

# 上传
scp -i "D:\下载\3xbang.pem" backend.tar.gz ubuntu@18.206.11.7:~/backend/

# SSH 到服务器
ssh -i "D:\下载\3xbang.pem" ubuntu@18.206.11.7

# 在服务器上执行
cd ~/backend
tar -xzf backend.tar.gz
npm install --production
pm2 restart construction-api
```

---

## 📚 详细部署文档

| 文档 | 说明 |
|------|------|
| **DEPLOY_TO_AWS.md** | 🌟 **你的专属部署指南**（包含你的 IP 和密钥路径） |
| AWS_SIMPLE_DEPLOYMENT.md | 单服务器完整部署方案 |
| AWS_DEPLOYMENT_GUIDE.md | S3+CloudFront 分离架构方案 |
| WINAII_DEPLOYMENT.md | 配置总结和快速参考 |

---

## 🎯 首次部署流程

### Step 1: 连接并初始化服务器

```powershell
# 连接到服务器
.\ssh-connect.ps1
```

在服务器上运行：

```bash
# 1. 更新系统
sudo apt update && sudo apt upgrade -y

# 2. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. 安装其他工具
sudo apt install -y nginx postgresql postgresql-contrib git

# 4. 安装 PM2
sudo npm install -g pm2

# 5. 启动服务
sudo systemctl start nginx postgresql
sudo systemctl enable nginx postgresql

# 6. 创建目录
sudo mkdir -p /var/www/winaii.com /var/www/uploads
sudo chown -R ubuntu:ubuntu /var/www
mkdir -p ~/backend
```

### Step 2: 配置数据库

```bash
sudo -u postgres psql
```

在 PostgreSQL 中执行：

```sql
CREATE DATABASE construction_simple;
CREATE USER construction_user WITH PASSWORD 'Winaii2024!@#Strong';
GRANT ALL PRIVILEGES ON DATABASE construction_simple TO construction_user;
ALTER DATABASE construction_simple OWNER TO construction_user;
\q
```

### Step 3: 上传数据库结构

**本地 PowerShell**：

```powershell
scp -i "D:\下载\3xbang.pem" E:\3XBANG\docs\simple-database-schema.sql ubuntu@18.206.11.7:~/
```

**服务器**：

```bash
psql -U construction_user -d construction_simple -f ~/simple-database-schema.sql
# 密码：Winaii2024!@#Strong
```

### Step 4: 部署后端

**本地**：

```powershell
.\deploy-backend.ps1
```

**服务器上配置 .env**（首次需要）：

```bash
cd ~/backend
nano .env
```

粘贴：

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

启动后端：

```bash
pm2 start src/server.js --name construction-api --max-memory-restart 768M
pm2 save
pm2 startup  # 执行输出的命令
```

### Step 5: 配置 Nginx

```bash
sudo nano /etc/nginx/sites-available/winaii
```

使用 **DEPLOY_TO_AWS.md** 中的 Nginx 配置。

启用：

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/winaii /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: 部署前端

**本地**：

```powershell
.\deploy-frontend.ps1
```

### Step 7: 测试访问

浏览器打开：`http://18.206.11.7`

应该看到登录页面！

### Step 8: 配置域名（可选）

在域名注册商添加 A 记录：
- 名称：`@` 或 `winaii.com`
- 值：`18.206.11.7`

等待 DNS 生效。

### Step 9: 配置 SSL（DNS 生效后）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d winaii.com -d www.winaii.com
```

---

## 📊 常用命令

### 查看状态

```bash
# 连接服务器
.\ssh-connect.ps1

# 查看后端状态
pm2 status

# 查看日志
pm2 logs construction-api

# 查看 Nginx 状态
sudo systemctl status nginx
```

### 重启服务

```bash
pm2 restart construction-api
sudo systemctl restart nginx
```

### 查看系统资源

```bash
# CPU 和内存
htop  # 或 top

# 磁盘空间
df -h

# 端口占用
netstat -tlnp
```

---

## 🔧 故障排查

### 问题 1：无法 SSH 连接

**解决**：
1. 检查密钥文件权限
2. 确认服务器 IP 正确
3. 检查 AWS 安全组是否开放 22 端口

### 问题 2：网站无法访问

```bash
# 检查 Nginx
sudo nginx -t
sudo systemctl status nginx

# 检查防火墙
sudo ufw status
```

### 问题 3：API 报错

```bash
# 查看后端日志
pm2 logs construction-api --lines 50

# 重启后端
pm2 restart construction-api

# 检查端口
netstat -tlnp | grep 3000
```

### 问题 4：数据库连接失败

```bash
# 检查数据库状态
sudo systemctl status postgresql

# 测试连接
psql -U construction_user -d construction_simple
```

---

## 🎯 测试账号

登录测试：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 老板 | `boss` | `Admin@123` |
| 工人 | `zhangsan` | `Worker@123` |

---

## 📱 访问地址

- **IP 直接访问**：http://18.206.11.7
- **域名访问**（DNS 生效后）：http://winaii.com
- **HTTPS 访问**（SSL 配置后）：https://winaii.com
- **API 地址**：https://winaii.com/api

---

## 💡 提示

1. **首次部署**：按照上面的 Step 1-9 顺序执行
2. **日常更新**：直接运行 `.\deploy-frontend.ps1` 或 `.\deploy-backend.ps1`
3. **查看日志**：运行 `.\ssh-connect.ps1` 连接后执行 `pm2 logs construction-api`
4. **紧急重启**：SSH 连接后执行 `pm2 restart construction-api`

---

## 📞 需要帮助？

如果遇到问题：

1. 查看详细文档：**DEPLOY_TO_AWS.md**
2. 检查服务状态：`pm2 status` 和 `pm2 logs`
3. 查看 Nginx 日志：`sudo tail -f /var/log/nginx/error.log`

---

**祝部署顺利！🎉**
