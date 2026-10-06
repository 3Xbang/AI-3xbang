# 部署指南 - winaii.com

## 🌐 域名配置

- **域名**：`winaii.com`
- **前端 URL**：`https://winaii.com`
- **后端 API**：`https://winaii.com/api`

---

## 📋 部署架构

```
┌─────────────────────────────────────────┐
│         域名: winaii.com                 │
│              ⬇                          │
│         Nginx 反向代理                   │
│              ⬇                          │
│    ┌─────────┴─────────┐                │
│    ⬇                   ⬇                │
│  静态文件            Node.js API         │
│  /dist               :3000               │
│  (Vue 构建产物)      (Express)          │
└─────────────────────────────────────────┘
```

---

## 🚀 部署步骤

### Step 1: 后端部署

#### 1.1 安装依赖

```bash
cd backend
npm install --production
```

#### 1.2 配置环境变量

创建 `.env` 文件：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_db
DB_USER=postgres
DB_PASSWORD=your_password

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# 服务器配置
PORT=3000
NODE_ENV=production

# 文件上传路径
UPLOAD_DIR=/var/www/uploads
```

#### 1.3 初始化数据库

```bash
# 登录 PostgreSQL
psql -U postgres

# 创建数据库
CREATE DATABASE construction_db;

# 执行 SQL 脚本
psql -U postgres -d construction_db -f ../docs/simple-database-schema.sql
```

#### 1.4 启动后端服务

使用 PM2 管理进程：

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/server.js --name construction-api --max-memory-restart 768M

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

或者创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'construction-api',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '768M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

启动：
```bash
pm2 start ecosystem.config.js
```

---

### Step 2: 前端部署

#### 2.1 构建生产版本

```bash
cd frontend-mobile

# 安装依赖
npm install

# 构建 H5 网页版本
npm run build:h5
```

构建产物在 `dist/build/h5/` 目录。

#### 2.2 上传到服务器

将 `dist/build/h5/` 目录内容上传到服务器：

```bash
# 使用 scp
scp -r dist/build/h5/* root@your-server-ip:/var/www/winaii.com/

# 或使用 rsync
rsync -avz dist/build/h5/ root@your-server-ip:/var/www/winaii.com/
```

---

### Step 3: Nginx 配置

#### 3.1 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx

# 启动 Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 3.2 配置 SSL 证书（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d winaii.com -d www.winaii.com
```

#### 3.3 Nginx 站点配置

创建 `/etc/nginx/sites-available/winaii.com`：

```nginx
# HTTP -> HTTPS 重定向
server {
    listen 80;
    server_name winaii.com www.winaii.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 主站
server {
    listen 443 ssl http2;
    server_name winaii.com www.winaii.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/winaii.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/winaii.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端静态文件
    root /var/www/winaii.com;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/x-font-ttf font/opentype image/svg+xml;

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

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### 3.4 启用配置并重启

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/winaii.com /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

---

## 🔍 验证部署

### 1. 检查后端 API

```bash
curl https://winaii.com/api/health
```

预期返回：
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2024-10-06T..."
}
```

### 2. 检查前端页面

浏览器访问：`https://winaii.com`

应该能看到登录页面。

### 3. 检查 HTTPS

确保：
- HTTP 自动跳转到 HTTPS
- SSL 证书有效（绿色锁图标）
- 无混合内容警告

---

## 📊 监控与维护

### PM2 进程管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs construction-api

# 重启服务
pm2 restart construction-api

# 停止服务
pm2 stop construction-api
```

### Nginx 日志

```bash
# 访问日志
sudo tail -f /var/log/nginx/access.log

# 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 数据库备份

```bash
# 每日自动备份脚本
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -U postgres construction_db > /backups/construction_db_$DATE.sql

# 保留最近 7 天
find /backups -name "construction_db_*.sql" -mtime +7 -delete
```

添加到 crontab：
```bash
crontab -e
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup_script.sh
```

---

## 🔧 故障排查

### 前端无法连接后端

1. 检查 API 地址：浏览器 DevTools -> Network -> 查看请求 URL
2. 检查 CORS：确保后端配置了正确的 CORS
3. 检查 Nginx 代理：`sudo nginx -t` 测试配置

### 502 Bad Gateway

1. 检查后端服务是否运行：`pm2 status`
2. 检查端口占用：`netstat -tulpn | grep 3000`
3. 查看后端日志：`pm2 logs construction-api`

### 照片上传失败

1. 检查上传目录权限：`ls -la /var/www/uploads`
2. 确保 Nginx 有读写权限：`sudo chown -R www-data:www-data /var/www/uploads`
3. 检查磁盘空间：`df -h`

---

## 📱 网页版特性

### 响应式设计
- 支持桌面浏览器（Chrome、Firefox、Safari、Edge）
- 支持移动浏览器（iOS Safari、Android Chrome）
- 自适应屏幕尺寸

### PWA 功能（可选）
可添加 PWA 支持实现：
- 添加到主屏幕
- 离线缓存
- 消息推送

### 浏览器兼容性
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 🔐 安全建议

1. **定期更新**
   - 更新 Node.js 依赖：`npm audit fix`
   - 更新系统包：`apt update && apt upgrade`

2. **防火墙配置**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

3. **SSL 证书自动续期**
   ```bash
   sudo certbot renew --dry-run
   ```

4. **数据库安全**
   - 使用强密码
   - 限制远程访问
   - 定期备份

---

## 📞 联系方式

- **域名**：winaii.com
- **后端**：Node.js + Express + PostgreSQL
- **前端**：Uni-app H5 (Vue 3)
- **服务器**：AWS t2.micro (1GB RAM)

---

**最后更新**：2024-10-06
