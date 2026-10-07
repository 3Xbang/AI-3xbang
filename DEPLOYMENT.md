# 极简版施工管理系统 - 部署文档

## 系统架构

- **前端**: 纯HTML + Vanilla JavaScript (无框架)
- **后端**: Node.js + Express
- **数据库**: PostgreSQL 12+
- **反向代理**: Nginx
- **进程管理**: PM2

## 服务器信息

- **服务器IP**: 18.206.11.7
- **系统**: Amazon Linux 2
- **SSH Key**: C:\Users\ASUS\.ssh\3xbang.pem
- **用户**: ec2-user

## 目录结构

```
~/AI-3xbang/
├── backend/                  # 后端API代码
│   ├── src/
│   │   ├── server.js        # Express服务器
│   │   ├── routes.js        # API路由
│   │   ├── config/db.js     # 数据库配置
│   │   └── middleware-auth.js # JWT认证中间件
│   ├── uploads/             # 照片上传目录
│   ├── package.json
│   └── .env                 # 环境变量
├── frontend/                # 前端代码
│   ├── index.html           # 主页面
│   ├── css/styles.css       # 样式
│   └── js/
│       ├── app.js           # 主应用逻辑
│       ├── api.js           # API调用封装
│       └── i18n.js          # 中泰双语支持
├── database/                # 数据库脚本
│   ├── schema.sql           # 数据库架构
│   └── fix_admin_password.sql
└── nginx-construction.conf  # Nginx配置
```

## 部署路径

- **前端**: `/var/www/construction/`
- **后端**: `~/AI-3xbang/backend/` (PM2管理)
- **上传文件**: `~/AI-3xbang/backend/uploads/`
- **Nginx配置**: `/etc/nginx/conf.d/nginx-construction.conf`

## 访问地址

- **前端页面**: http://18.206.11.7/
- **API健康检查**: http://18.206.11.7/health
- **API端点**: http://18.206.11.7/api/

## 数据库信息

- **数据库名**: construction_simple
- **用户名**: construction_user
- **密码**: Winaii2024Strong
- **主机**: localhost:5432

### 数据库表结构

1. **users** - 用户表
2. **projects** - 项目表 (name/location使用JSONB中泰双语)
3. **process_nodes** - 工序节点表 (16个标准工序)
4. **process_execution** - 工序执行记录表
5. **materials** - 材料表 (material_name/unit使用JSONB)
6. **material_usage** - 材料使用记录表
7. **photos** - 现场照片表

## 默认账号

- **用户名**: admin
- **密码**: admin123
- **角色**: admin

## 服务管理

### 后端API (PM2)

```bash
# 查看状态
pm2 status

# 重启服务
pm2 restart construction-api

# 查看日志
pm2 logs construction-api

# 查看最近20行日志
pm2 logs construction-api --lines 20
```

### Nginx

```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx

# 重启nginx
sudo systemctl restart nginx

# 查看状态
sudo systemctl status nginx
```

### 数据库

```bash
# 连接数据库
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple

# 查看表
\dt

# 查看用户
SELECT * FROM users;

# 退出
\q
```

## 部署流程

### 1. 更新代码

```bash
cd ~/AI-3xbang
git pull
```

### 2. 更新后端

```bash
cd backend
npm install  # 如果package.json有变化
pm2 restart construction-api
```

### 3. 更新前端

```bash
sudo cp -r frontend/* /var/www/construction/
sudo chown -R nginx:nginx /var/www/construction
```

### 4. 更新数据库

```bash
cd database
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -f schema.sql
```

### 5. 更新Nginx配置

```bash
sudo cp nginx-construction.conf /etc/nginx/conf.d/
sudo nginx -t
sudo systemctl reload nginx
```

## 环境变量 (.env)

```bash
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=construction_simple
DB_USER=construction_user
DB_PASSWORD=Winaii2024Strong
JWT_SECRET=your-secret-key-change-in-production-2024
JWT_EXPIRES_IN=24h
UPLOAD_DIR=./uploads
```

## API端点列表

### 认证
- `POST /api/auth/login` - 用户登录

### 项目
- `GET /api/projects` - 获取项目列表
- `POST /api/projects` - 创建项目
- `GET /api/projects/:id/summary` - 获取项目摘要

### 工序
- `GET /api/projects/:projectId/processes` - 获取项目工序列表
- `PUT /api/processes/:id` - 更新工序状态

### 材料
- `GET /api/projects/:projectId/materials` - 获取项目材料
- `POST /api/materials/usage` - 记录材料使用

### 照片
- `GET /api/photos/project/:projectId` - 获取项目照片
- `POST /api/photos/upload` - 上传照片

## 16个标准工序

1. **N01_EXCAVATION** - 土方开挖 / ขุดดิน
2. **N02_FOUNDATION** - 地基浇筑 / เทฐานราก
3. **N03_STRUCTURE** - 主体框架 / โครงสร้างหลัก
4. **N04_ROOF_FRAME** - 屋面封顶 / มุงหลังคา
5. **N05_MEP_ROUGH** - 水电布管 / เดินท่อน้ำและไฟ
6. **N06_MEP_HIDDEN** - 水电隐蔽工程 / ตรวจงานซ่อนน้ำไฟ
7. **N07_WATERPROOF** - 防水工程 / งานกันซึม
8. **N08_WALL_PARTITION** - 砌墙隔断 / ก่อผนัง
9. **N09_PLASTERING** - 泥瓦抹灰 / ฉาบปูน
10. **N10_TILING** - 瓷砖铺贴 / ปูกระเบื้อง
11. **N11_CEILING** - 木工吊顶 / ทำฝ้าเพดาน
12. **N12_PAINTING** - 油漆涂刷 / ทาสี
13. **N13_DOOR_WINDOW** - 门窗安装 / ติดตั้งประตูหน้าต่าง
14. **N14_SANITARY** - 洁具安装 / ติดตั้งสุขภัณฑ์
15. **N15_LIGHTING** - 灯具开关 / ติดตั้งไฟและสวิตช์
16. **N16_CLEANING** - 清洁验收 / ทำความสะอาดและตรวจรับ

## 工序状态

- **not_started** - 未开始
- **in_progress** - 进行中
- **waiting_material** - 等待材料 (关键：区分是缺材料还是工人慢)
- **weather_stop** - 天气停工
- **completed** - 已完成

## 故障排查

### 前端无法加载

```bash
# 检查Nginx
sudo nginx -t
sudo systemctl status nginx

# 检查文件权限
ls -la /var/www/construction/
sudo chown -R nginx:nginx /var/www/construction
```

### API报错

```bash
# 检查PM2状态
pm2 status
pm2 logs construction-api --lines 50

# 检查端口
sudo netstat -tlnp | grep 3001

# 重启API
pm2 restart construction-api
```

### 数据库连接失败

```bash
# 检查PostgreSQL状态
sudo systemctl status postgresql

# 测试连接
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -c "SELECT 1;"

# 重启PostgreSQL
sudo systemctl restart postgresql
```

### 登录失败

```bash
# 重置admin密码
cd ~/AI-3xbang/database
PGPASSWORD=Winaii2024Strong psql -U construction_user -d construction_simple -f fix_admin_password.sql
```

## 性能优化建议

1. **启用Gzip压缩** (Nginx)
2. **设置静态资源缓存**
3. **PM2集群模式** (如果需要)
4. **数据库索引优化**
5. **图片压缩** (上传前)

## 安全建议

1. ✅ 使用JWT认证
2. ✅ 密码bcrypt加密
3. ⚠️ 生产环境修改JWT_SECRET
4. ⚠️ 启用HTTPS (Let's Encrypt)
5. ⚠️ 配置防火墙规则
6. ⚠️ 定期备份数据库

## 备份命令

```bash
# 备份数据库
pg_dump -U construction_user construction_simple > backup_$(date +%Y%m%d).sql

# 备份上传文件
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz ~/AI-3xbang/backend/uploads/
```

## 开发团队

- 为泰国20人施工队定制
- 极简设计，专注核心功能
- 中泰双语支持

---

最后更新: 2026-10-07
版本: v1.0.0 极简版
