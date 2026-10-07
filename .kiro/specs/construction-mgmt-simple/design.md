# Design: 泰国施工管理系统

## 数据库设计

### 核心表（5个）
1. projects - 项目表
2. process_execution - 工序执行记录
3. materials - 材料表
4. material_usage - 材料使用记录
5. photos - 照片表

### 多语言方案
- 使用PostgreSQL JSONB字段
- 工序名称：{"zh": "土方开挖", "th": "ขุดดิน"}
- 材料名称：{"zh": "水泥", "th": "ปูนซีเมนต์"}

## API设计
- JWT认证
- RESTful API
- 前端处理照片水印

## 前端设计
- 单页面HTML + 原生JS
- i18n多语言切换
- 响应式布局

详细设计见数据库迁移文件和代码注释。
