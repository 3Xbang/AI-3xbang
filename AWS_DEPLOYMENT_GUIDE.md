# AWS 部署指南 - winaii.com

## 🏗️ 推荐架构（方案 B）

```
┌─────────────────────────────────────────────────────────┐
│                     Route 53 (DNS)                       │
│                   winaii.com 域名解析                     │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  CloudFront     │    │   EC2 Instance   │
│  (CDN 加速)      │    │   (后端 API)      │
│                 │    │  t2.micro 1GB    │
│  静态文件分发     │    │  Node.js + PM2   │
└────────┬────────┘    └────────┬─────────┘
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌──────────────────┐
│   S3 Bucket     │    │  RDS PostgreSQL  │
│  (前端构建产物)   │    │  (数据库)         │
│  index.html...  │    │  db.t3.micro     │
└─────────────────┘    └──────────────────┘
```

**成本估算**：
- CloudFront: ~$1-5/月（流量少时）
- S3: ~$0.5/月
- EC2 t2.micro: ~$8-10/月
- RDS t3.micro: ~$15-20/月（可选自建省钱）
- Route 53: ~$0.5/月
- **总计**：~$25-35/月（使用 RDS）或 ~$10-15/月（自建数据库）

---

## 📋 部署步骤

### Step 1: 域名配置（Route 53）

#### 1.1 转入域名到 Route 53（可选）

如果域名在其他地方：
1. 登录 AWS Console → Route 53
2. 创建 Hosted Zone for `winaii.com`
3. 记录 4 个 NS 服务器地址
4. 在原域名注册商处修改 NS 记录

#### 1.2 创建 DNS 记录

```
类型: A 记录
名称: winaii.com
值: <CloudFront Distribution 域名>（后续步骤获取）
别名: 是
```

```
类型: A 记录
名称: api.winaii.com
值: <EC2 公网 IP>
别名: 否
```

---

### Step 2: 前端部署（S3 + CloudFront）

#### 2.1 创建 S3 Bucket

1. 登录 AWS Console → S3
2. 创建 Bucket：
   - Bucket 名称：`winaii-frontend`（名字可自定义）
   - 区域：选择离泰国最近的（如 `ap-southeast-1` 新加坡）
   - 取消勾选"阻止所有公共访问"
   - 其他保持默认

3. 配置静态网站托管：
   - 属性 → 静态网站托管 → 启用
   - 索引文档：`index.html`
   - 错误文档：`index.html`（SPA 路由）

4. 设置 Bucket 策略：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::winaii-frontend/*"
    }
  ]
}
```

#### 2.2 构建并上传前端

```bash
# 本地构建
cd frontend-mobile
npm install
npm run build:h5

# 上传到 S3（需安装 AWS CLI）
aws s3 sync dist/build/h5/ s3://winaii-frontend/ --delete

# 或使用 S3 控制台手动上传 dist/build/h5/ 目录内容
```

#### 2.3 配置 CloudFront

1. 创建 Distribution：
   - Origin Domain：选择 S3 bucket `winaii-frontend.s3-website-ap-southeast-1.amazonaws.com`
   - Viewer Protocol Policy：Redirect HTTP to HTTPS
   - Allowed HTTP Methods：GET, HEAD, OPTIONS
   - Alternate Domain Names (CNAMEs)：`winaii.com`, `www.winaii.com`

2. 配置 SSL 证书：
   - 使用 ACM（AWS Certificate Manager）申请免费证书
   - 区域必须选择 `us-east-1`（CloudFront 要求）
   - 域名：`winaii.com` 和 `*.winaii.com`
   - 验证方式：DNS 验证（在 Route 53 自动添加）

3. 配置错误页面（SPA 路由）：
   - Error Pages → Create Custom Error Response
   - HTTP Error Code: 403, 404
   - Customize Error Response: Yes
   - Response Page Path: `/index.html`
   - HTTP Response Code: 200

4. 创建后等待部署（15-20分钟）

5. 获取 CloudFront 域名：
   - 如：`d1234abcd.cloudfront.net`

#### 2.4 更新 Route 53

创建 A 记录指向 CloudFront：
```
类型: A 记录
名称: winaii.com
别名: 是
别名目标: <CloudFront Distribution>
```

---

### Step 3: 后端部署（EC2）

#### 3.1 创建 EC2 实例

1. 登录 AWS Console → EC2 → Launch Instance

2. 配置：
   - **名称**：`winaii-backend`
   - **AMI**：Ubuntu Server 22.04 LTS
   - **实例类型**：t2.micro（1 vCPU, 1GB RAM）
   - **密钥对**：创建新密钥对（下载 .pem 文件）
   - **网络设置**：
     - 创建安全组，允许：
       - SSH (22) - 你的 IP
       - HTTP (80) - 0.0.0.0/0
       - HTTPS (443) - 0.0.0.0/0
       - Custom TCP (3000) - 0.0.0.0/0（临时，后续可关闭）
   - **存储**：8-16 GB gp3

3. 启动实例，等待状态变为 Running

4. 记录公网 IP：如 `3.1.123.45`

#### 3.2 连接到 EC2

```bash
# Windows 用户使用 PowerShell 或 PuTTY
# Mac/Linux 用户
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@3.1.123.45
```

#### 3.3 安装环境

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应显示 v18.x.x
npm --version

# 安装 PM2
sudo npm install -g pm2

# 安装 PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 启动 PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 3.4 配置数据库

```bash
# 切换到 postgres 用户
sudo -u postgres psql

# 在 psql 中执行：
CREATE DATABASE construction_simple;
CREATE USER construction_user WITH PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE construction_simple TO construction_user;
\q

# 导入数据库结构（从本地上传 SQL 文件）
# 先退出 SSH，在本地执行：
scp -i your-key.pem docs/simple-database-schema.sql ubuntu@3.1.123.45:~/

# 回到 SSH，导入数据库
psql -U construction_user -d construction_simple -f ~/simple-database-schema.sql
```

#### 3.5 部署后端代码

```bash
# 方式1：从 GitHub（推荐）
cd /home/ubuntu
git clone https://github.com/your-repo/3xbang.git
cd 3xbang/backend

# 方式2：从本地上传（在本地执行）
# 先打包
cd backend
npm install --production
tar -czf backend.tar.gz .

# 上传
scp -i your-key.pem backend.tar.gz ubuntu@3.1.123.45:~/
# SSH 到服务器解压
ssh -i your-key.pem ubuntu@3.1.123.45
mkdir -p /home/ubuntu/backend
tar -xzf backend.tar.gz -C /home/ubuntu/backend
cd /home/ubuntu/backend
```

#### 3.6 配置环境变量

```bash
cd /home/ubuntu/backend

# 创建 .env 文件
nano .env
```

输入以下内容：

```bash
# 服务器配置
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_simple
DB_USER=construction_user
DB_PASSWORD=your_strong_password_here

# JWT 配置（修改为随机字符串）
JWT_SECRET=aB3$xY9#mK2@pL7!qR4&sT8%uV6^wZ1*
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_DIR=/home/ubuntu/uploads
MAX_FILE_SIZE=10485760
MAX_FILES=10
```

保存退出（Ctrl+O, Enter, Ctrl+X）

#### 3.7 创建上传目录

```bash
mkdir -p /home/ubuntu/uploads
chmod 755 /home/ubuntu/uploads
```

#### 3.8 启动后端服务

```bash
cd /home/ubuntu/backend

# 安装依赖（如果还没安装）
npm install --production

# 使用 PM2 启动
pm2 start src/server.js --name construction-api --max-memory-restart 768M

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
# 按照提示执行输出的命令（sudo env PATH=...）

# 查看状态
pm2 status
pm2 logs construction-api
```

#### 3.9 配置 Nginx（可选，推荐）

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/winaii-api
```

输入以下内容：

```nginx
server {
    listen 80;
    server_name api.winaii.com;

    # 上传文件大小限制
    client_max_body_size 10M;

    # API 代理
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/winaii-api /etc/nginx/sites-enabled/

# 删除默认配置
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

#### 3.10 配置 SSL（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d api.winaii.com

# 自动续期（已自动配置 cron）
sudo certbot renew --dry-run
```

---

### Step 4: 更新前端 API 地址

修改前端 API 地址为 EC2 公网地址或域名。

**选项 A**：使用 `api.winaii.com`（推荐）

编辑 `frontend-mobile/utils/request.js`：

```javascript
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.winaii.com'      // 使用子域名
  : 'http://localhost:3000/api'
```

**选项 B**：使用同域名路径

```javascript
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://winaii.com/api'      // 同域名，需配置 CloudFront
  : 'http://localhost:3000/api'
```

如果选择 B，需要在 CloudFront 添加额外的 Origin：
- Origin Domain: `api.winaii.com`
- Path Pattern: `/api/*`
- Forward Headers: All

重新构建并上传：

```bash
cd frontend-mobile
npm run build:h5
aws s3 sync dist/build/h5/ s3://winaii-frontend/ --delete

# 清除 CloudFront 缓存
aws cloudfront create-invalidation --distribution-id E1234ABCD --paths "/*"
```

---

### Step 5: 配置 CORS

确保后端 `backend/src/app.js` 中的 CORS 配置包含你的域名：

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'https://winaii.com',
  'https://www.winaii.com',
  'https://api.winaii.com'
];
```

重启后端：

```bash
pm2 restart construction-api
```

---

## 🔍 验证部署

### 1. 检查前端

访问：`https://winaii.com`

应该看到登录页面。

### 2. 检查后端 API

```bash
curl https://api.winaii.com/health
```

应返回：
```json
{
  "success": true,
  "message": "API is running"
}
```

### 3. 测试登录

使用浏览器开发者工具（F12）：
- Network 标签查看请求
- 确保请求到 `https://api.winaii.com`
- 检查是否有 CORS 错误

---

## 📊 监控与维护

### CloudWatch 监控（推荐）

1. EC2 → 实例 → 监控
2. 查看 CPU、内存、网络使用情况
3. 设置告警（CPU > 80%）

### 日志管理

```bash
# PM2 日志
pm2 logs construction-api

# Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 自动备份数据库

创建备份脚本 `/home/ubuntu/backup.sh`：

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/ubuntu/backups
mkdir -p $BACKUP_DIR

# 备份数据库
pg_dump -U construction_user construction_simple > $BACKUP_DIR/db_$DATE.sql

# 上传到 S3（可选）
aws s3 cp $BACKUP_DIR/db_$DATE.sql s3://winaii-backups/

# 保留最近 7 天
find $BACKUP_DIR -name "db_*.sql" -mtime +7 -delete
```

添加到 crontab：

```bash
chmod +x /home/ubuntu/backup.sh
crontab -e
# 添加：每天凌晨 2 点备份
0 2 * * * /home/ubuntu/backup.sh
```

---

## 💰 成本优化建议

### 1. 使用 RDS Free Tier（首年免费）
- db.t2.micro（或 t3.micro）
- 20GB 存储
- 单可用区

### 2. 保留 IP 地址
- 分配弹性 IP（Elastic IP）防止重启后 IP 变化
- 未使用的 EIP 会收费，记得关联到实例

### 3. S3 生命周期策略
- 设置过期策略清理旧的上传照片

### 4. CloudFront 缓存优化
- 设置合理的 TTL
- 启用压缩

---

## 🔧 故障排查

### 前端无法访问

1. 检查 CloudFront Distribution 状态（是否 Deployed）
2. 检查 Route 53 DNS 记录
3. 清除 CloudFront 缓存
4. 检查 S3 Bucket 策略

### API 502/504 错误

1. 检查 EC2 实例状态
2. SSH 登录检查 PM2：`pm2 status`
3. 检查端口：`netstat -tlnp | grep 3000`
4. 查看日志：`pm2 logs construction-api`

### 数据库连接失败

1. 检查 PostgreSQL 状态：`sudo systemctl status postgresql`
2. 检查连接：`psql -U construction_user -d construction_simple`
3. 查看 `.env` 配置是否正确

---

## 📞 技术支持

- **域名**：winaii.com
- **前端**：S3 + CloudFront
- **后端**：EC2 t2.micro + PostgreSQL
- **区域**：ap-southeast-1（新加坡，离泰国近）

---

**最后更新**：2024-10-06
