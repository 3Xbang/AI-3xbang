# Mira Villa 管理系统 - 重大重构方案

## 🎯 项目重新定位

### 品牌信息
- **英文名称：** Mira Villa Management System
- **泰文名称：** ระบบจัดการมิร่าวิลล่า (Mira Villa)
- **备选：** Mira Project Management / โครงการมิร่า
- **主要语言：** 泰语（Thai）
- **次要语言：** 中文

---

## 🏗️ 导航架构重构

### 当前架构（问题）
```
登录 → 主界面（显示所有菜单）
├── 今日任务
├── 项目管理
├── 工序进度
├── 材料管理
├── 现场照片
└── 用户管理
```

### 新架构（目标）
```
登录 → 项目列表（Project Dashboard）
       ├── 选择项目 → 项目详情页
                      ├── 今日任务 (Daily Tasks)
                      ├── 工序进度 (Process Management)
                      ├── 材料管理 (Material Management)
                      ├── 现场照片 (Site Photos)
                      └── 项目设置 (Project Settings)

独立菜单（顶部）
├── 项目管理 (所有项目列表)
└── 用户管理 (仅管理员)
```

---

## 📐 工序系统重构

### 当前问题
- 工序结构混乱
- 子任务嵌套子任务
- 没有标准工序库

### 新工序系统架构

#### 1. 工序模板库（基于中国建筑标准）

**新建工程施工类别：**

##### A. 土建工程 (Civil Works)
1. **基础工程** (Foundation)
   - 场地平整 (Site Leveling)
   - 基坑开挖 (Excavation)
   - 地基处理 (Ground Treatment)
   - 基础浇筑 (Foundation Casting)
   - 防水处理 (Waterproofing)

2. **主体结构** (Main Structure)
   - 柱子施工 (Column Construction)
   - 梁板施工 (Beam & Slab)
   - 剪力墙施工 (Shear Wall)
   - 楼板浇筑 (Floor Casting)
   - 屋面工程 (Roofing)

3. **砌筑工程** (Masonry)
   - 砖墙砌筑 (Brick Wall)
   - 隔墙施工 (Partition Wall)
   - 门窗洞口 (Door/Window Opening)

##### B. 装修工程 (Finishing Works)
1. **抹灰工程** (Plastering)
   - 内墙抹灰 (Interior Plastering)
   - 外墙抹灰 (Exterior Plastering)
   - 天花抹灰 (Ceiling Plastering)

2. **地面工程** (Flooring)
   - 地面找平 (Floor Leveling)
   - 地砖铺贴 (Floor Tiles)
   - 木地板安装 (Wood Flooring)
   - 地毯铺设 (Carpet)

3. **天花工程** (Ceiling)
   - 吊顶龙骨 (Ceiling Frame)
   - 石膏板吊顶 (Gypsum Ceiling)
   - 铝扣板吊顶 (Aluminum Ceiling)

4. **墙面工程** (Wall Finishing)
   - 墙面找平 (Wall Leveling)
   - 腻子批刮 (Putty)
   - 乳胶漆 (Latex Paint)
   - 墙砖铺贴 (Wall Tiles)
   - 墙纸粘贴 (Wallpaper)

5. **门窗工程** (Doors & Windows)
   - 门框安装 (Door Frame)
   - 门扇安装 (Door Leaf)
   - 窗框安装 (Window Frame)
   - 玻璃安装 (Glass Installation)

6. **水电工程** (MEP)
   - 给水管道 (Water Supply)
   - 排水管道 (Drainage)
   - 强电布线 (Electrical Wiring)
   - 弱电布线 (Low Voltage)
   - 灯具安装 (Lighting)
   - 插座面板 (Outlets & Switches)

7. **卫浴安装** (Sanitary)
   - 洁具安装 (Toilet Installation)
   - 洗手盆 (Wash Basin)
   - 淋浴房 (Shower Room)
   - 浴缸 (Bathtub)

8. **厨房工程** (Kitchen)
   - 橱柜安装 (Cabinet)
   - 台面安装 (Countertop)
   - 水槽安装 (Sink)
   - 厨电安装 (Kitchen Appliances)

#### 2. 项目工序管理流程

**新建项目时：**
```
1. 创建项目基本信息
2. 选择项目类型：
   ☐ 新建别墅 (New Villa)
   ☐ 装修改造 (Renovation)
   ☐ 混合项目 (Mixed)

3. 选择工程内容：
   ☐ 土建工程
   ☐ 装修工程
   ☐ 水电工程
   ☐ 景观工程

4. 为每个选中的工程类别，选择具体工序

5. 为每个工序设置：
   - 计划开始时间
   - 计划完成时间
   - 预计工作量（面积/长度/数量）
   - 单位（㎡/m/个/点位）
   - 负责人
```

#### 3. 工序档案管理

**每个工序包含：**
- 工序编号 (Process Code)
- 工序名称（中文/泰文）
- 工作量信息
  - 设计数量 (Designed Quantity)
  - 单位 (Unit): ㎡, m³, m, 件, 点位
  - 实际完成数量 (Actual Quantity)
- 时间信息
  - 计划开始 (Planned Start)
  - 计划完成 (Planned End)
  - 实际开始 (Actual Start)
  - 实际完成 (Actual End)
- 人员分配 (Workers)
- 材料清单 (Materials)
- 进度照片 (Photos)
- 备注说明 (Notes)

**不再有"子任务的子任务"，而是：**
- 工序 = 独立的施工项
- 每个工序可以有测量记录
- 每个工序可以有进度更新
- 每个工序关联材料和人员

---

## 🎨 UI/UX 优化

### 1. 登录页面
**新设计：**
```html
<h1>Mira Villa</h1>
<p>ระบบจัดการโครงการก่อสร้าง</p>
<p>Construction Management System</p>
```

### 2. 配色方案
**当前问题：** 紫色背景不专业

**新配色：**
- **主色：** 深蓝色 #1e3a8a (专业、稳重)
- **次色：** 青色 #0891b2 (现代、科技)
- **强调色：** 橙色 #f97316 (活力、醒目)
- **成功色：** 绿色 #10b981
- **警告色：** 黄色 #f59e0b
- **危险色：** 红色 #ef4444
- **背景：** 浅灰 #f8fafc
- **卡片：** 白色 #ffffff

### 3. 侧边栏优化
**移除：**
- ❌ "nav.users" 显示问题
- ❌ 中文显示（改为泰文主导）

**新侧边栏（项目内）：**
```
📋 งานวันนี้ (Today's Tasks)
📊 ความคืบหน้า (Progress)
🧱 วัสดุ (Materials)
📷 รูปถ่าย (Photos)
⚙️ ตั้งค่า (Settings)
```

---

## 🔧 技术实现任务

### Phase 1: 品牌重命名 ✅
- [ ] 更新 index.html 标题
- [ ] 更新 i18n.js 翻译
- [ ] 泰语设为默认语言
- [ ] 更新登录页面显示

### Phase 2: 导航架构重构 🏗️
- [ ] 创建新的项目仪表盘页面
- [ ] 实现项目选择 → 进入项目详情
- [ ] 重构侧边栏为项目内导航
- [ ] 顶部保留：项目管理 + 用户管理

### Phase 3: 工序系统重构 🏗️
- [ ] 创建工序模板库数据库表
- [ ] 实现工序模板选择界面
- [ ] 重构工序管理逻辑
- [ ] 移除子任务嵌套
- [ ] 添加工序档案管理

### Phase 4: UI美化 🎨
- [ ] 更新配色方案
- [ ] 优化侧边栏样式
- [ ] 改进卡片设计
- [ ] 响应式优化

### Phase 5: Bug修复 🐛
- [ ] 修复材料管理新建按钮
- [ ] 修复导航显示问题
- [ ] 测试所有功能

---

## 📊 数据库架构调整

### 新增表：process_templates

```sql
CREATE TABLE process_templates (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50),  -- 'civil', 'finishing', 'mep', etc.
    code VARCHAR(20) UNIQUE,
    name_zh VARCHAR(200),
    name_th VARCHAR(200),
    default_unit VARCHAR(20),  -- 'sqm', 'cbm', 'meter', 'item', 'point'
    description_zh TEXT,
    description_th TEXT,
    display_order INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 修改表：process_execution

```sql
-- 添加字段
ALTER TABLE process_execution ADD COLUMN designed_quantity DECIMAL(10,2);
ALTER TABLE process_execution ADD COLUMN unit VARCHAR(20);
ALTER TABLE process_execution ADD COLUMN actual_quantity DECIMAL(10,2);
ALTER TABLE process_execution ADD COLUMN planned_start_date DATE;
ALTER TABLE process_execution ADD COLUMN planned_end_date DATE;
```

---

## 🚀 实施优先级

### 立即修复（今天）
1. ✅ 品牌重命名
2. ✅ 修复材料管理按钮
3. ✅ 修复导航显示
4. ✅ UI配色优化

### 短期重构（本周）
1. 🏗️ 导航架构调整
2. 🏗️ 项目仪表盘实现
3. 🏗️ 工序模板库创建

### 中期优化（下周）
1. 📐 工序系统完整重构
2. 📊 数据库架构调整
3. 🎨 全面UI美化

---

## ❓ 需要确认的问题

1. **项目名称确认：**
   - Mira Villa ✓
   - Mira Project
   - 或其他？

2. **默认语言：**
   - 泰语为主 ✓
   - 中文为辅 ✓

3. **工序范围：**
   - 是否需要更多工序类别？
   - 是否需要景观工程、弱电工程等？

4. **当前数据：**
   - 是否保留现有项目数据？
   - 是否需要数据迁移？

---

**准备好开始实施了吗？我建议先从立即修复开始！** 🚀
