# winaii.com 部署配置总结

## ✅ 已完成的配置修改

### 1. 前端 API 地址配置

**文件**：`frontend-mobile/utils/request.js`

```javascript
// 自动根据环境切换
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://winaii.com/api'      // 生产环境
  : 'http://localhost:3000/api'    // 开发环境
```

### 2. 后端 CORS 配置

**文件**：`backend/src/app.js`

```javascript
const allowedOrigins = [
  'http://localhost:5173',  // 本地开发
  'http://localhost:3000',  // 本地开发
  'https://winaii.com',     // 生产环境
  'https://www.winaii.com', // 生产环境（www）
];
```

### 3. 环境变量文件

**开发环境**：`frontend-mobile/.env.development`
```
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3000/api
```

**生产环境**：`frontend-mobile/.env.production`
```
NODE_ENV=production
VITE_API_BASE_URL=https://winaii.com/api
```

---

## 🚀 快速部署命令

### 前端构建并部署

```bash
# 1. 进入前端目录
cd frontend-mobile

# 2. 安装依赖
npm install

# 3. 构建 H5 生产版本
npm run build:h5

# 4. 上传到服务器（替换你的服务器 IP）
scp -r dist/build/h5/* root@your-server-ip:/var/www/winaii.com/
```

### 后端部署

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖
npm install --production

# 3. 创建 .env 文件
cp .env.example .env

# 4. 编辑 .env 填写数据库密码等配置
nano .env

# 5. 启动服务（使用 PM2）
pm2 start src/server.js --name construction-api --max-memory-restart 768M
pm2 save
```

---

## 📋 Nginx 配置（核心部分）

创建 `/etc/nginx/sites-available/winaii.com`：

```nginx
server {
    listen 443 ssl http2;
    server_name winaii.com www.winaii.com;

    # SSL 证书（Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/winaii.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/winaii.com/privkey.pem;

    # 前端静态文件
    root /var/www/winaii.com;
    index index.html;

    # 前端路由（SPA）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到 Node.js
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 上传文件访问
    location /uploads/ {
        alias /var/www/uploads/;
        expires 30d;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/winaii.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔐 SSL 证书（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d winaii.com -d www.winaii.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 📊 验证部署

### 1. 检查后端 API
```bash
curl https://winaii.com/api/health
```

应返回：
```json
{
  "success": true,
  "message": "API is running"
}
```

### 2. 检查前端
浏览器访问：`https://winaii.com`

应看到登录页面。

### 3. 检查进程
```bash
pm2 status
```

应看到 `construction-api` 在运行。

---

## 📱 访问地址

- **前端**：https://winaii.com
- **后端 API**：https://winaii.com/api
- **上传文件**：https://winaii.com/uploads/

---

## 🔧 常用管理命令

### PM2 进程管理
```bash
pm2 status                    # 查看状态
pm2 logs construction-api     # 查看日志
pm2 restart construction-api  # 重启服务
pm2 stop construction-api     # 停止服务
```

### Nginx 管理
```bash
sudo nginx -t                 # 测试配置
sudo systemctl restart nginx  # 重启 Nginx
sudo tail -f /var/log/nginx/access.log  # 查看访问日志
sudo tail -f /var/log/nginx/error.log   # 查看错误日志
```

### 数据库备份
```bash
pg_dump -U postgres construction_simple > backup_$(date +%Y%m%d).sql
```

---

## 🎯 测试账号

**老板账号**：
- 用户名：`boss`
- 密码：`Admin@123`

**工人账号**：
- 用户名：`zhangsan`
- 密码：`Worker@123`

---

## 📞 技术支持

- **域名**：winaii.com
- **系统**：极简工地管理系统
- **版本**：v1.0.0
- **最后更新**：2024-10-06

---

## ⚠️ 注意事项

1. **首次部署前**：
   - 确保域名已正确解析到服务器 IP
   - 确保防火墙开放 80、443 端口
   - 确保 PostgreSQL 已安装并运行

2. **安全提示**：
   - 修改 `.env` 中的 JWT_SECRET
   - 使用强密码
   - 定期备份数据库

3. **性能优化**：
   - t2.micro (1GB RAM) 需注意内存使用
   - PM2 设置 `--max-memory-restart 768M`
   - 定期清理上传文件

---

详细部署指南请参考：`DEPLOYMENT_GUIDE.md`
