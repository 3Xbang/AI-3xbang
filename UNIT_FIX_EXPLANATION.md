# 工程量单位修复说明 / Unit Fix Explanation

## 问题 Problem

之前的前端代码在用户输入工程量时，会**强制覆盖数据库中已设置好的标准单位**，导致：
1. 数据库中设置的标准单位（如 m²、根、樘）被忽略
2. 前端根据输入字段类型硬编码单位（如输入面积就强制为m²）
3. 无法使用预设的标准单位（根、樘、套、盏等）

**Before:** Frontend code forcibly overwrote database units when users input quantities.

---

## 修复内容 Fixes

### 1. **保护数据库中的标准单位 Protect Database Units**

修改了 `saveQuantityData` 函数：

#### 修复前 Before:
```javascript
const updateData = {
    planned_quantity: plannedQuantity,
    quantity_unit: quantityUnit  // ❌ 总是覆盖数据库单位
};
```

#### 修复后 After:
```javascript
// 先获取当前process以获得数据库中的单位
const processResponse = await api.processes.getById(processId);
const currentProcess = processResponse.process || {};

const updateData = {
    planned_quantity: plannedQuantity
    // ✅ 不再包含 quantity_unit，保持数据库值不变
};

// 只在数据库单位为空时才计算并设置单位
let quantityUnit = currentProcess.quantity_unit || '';
if (!quantityUnit) {
    // 根据字段类型推断单位
    quantityUnit = '...';
}
```

---

### 2. **在界面上显示数据库单位 Display Database Units in UI**

修改了量输入表单，增加单位提示：

```javascript
// 显示数据库中预设的单位
${process.quantity_unit ? 
  `<small class="form-hint" style="color: #059669;">
     单位 หน่วย: ${process.quantity_unit}
   </small>` 
  : ''}
```

---

### 3. **通用输入表单的单位字段只读 Make Unit Field Read-only**

对于已有标准单位的工序，单位字段变为只读：

```javascript
<input type="text" 
       id="qty-unit" 
       value="${process.quantity_unit || ''}" 
       ${process.quantity_unit ? 
         'readonly style="background-color: #f3f4f6; cursor: not-allowed;"' 
         : ''}>
${process.quantity_unit ? 
  '<small class="form-hint" style="color: #059669;">
     ✓ 已设置标准单位 (不可修改)
   </small>' 
  : '<small class="form-hint">可选：如 m²、m³、m、个等</small>'}
```

---

### 4. **实时计算使用数据库单位 Real-time Calculation Uses DB Units**

修改实时计算显示：

```javascript
const displayUnit = process.quantity_unit || result.unit;
resultDiv.textContent = `${result.value} ${displayUnit}`;
```

---

## 单位层级 Unit Hierarchy

现在系统有清晰的单位层级：

### 优先级 Priority:
1. **数据库预设单位** (最高优先级)
   - 由管理员/系统预先配置
   - 基于建筑行业标准
   - 用户不可修改
   
2. **字段类型推断单位** (第二优先级)
   - 当数据库没有单位时使用
   - 基于输入字段类型（area→m²、volume→m³等）
   
3. **用户输入单位** (最低优先级)
   - 仅用于没有任何预设的情况
   - 用于特殊工序

---

## 工程量单位完整列表 Complete Unit List

### 65个工序的单位分布 Unit Distribution:

| 单位 Unit | 数量 Count | 工序类型 Process Types |
|-----------|-----------|----------------------|
| **m²** | 43个 | 面积类：墙面、地面、吊顶、防水等 |
| **m³** | 6个 | 体积类：土方、混凝土浇筑 |
| **根** | 4个 | 柱子：钢筋、模板、混凝土、构造柱 |
| **樘** | 4个 | 门窗：框安装、门扇、窗扇、门窗整体 |
| **套** | 3个 | 卫浴：洁具、淋浴房 |
| **m** | 5个 | 长度类：管道、圈梁、橱柜、台面 |
| **盏** | 2个 | 灯具：灯具安装、灯具开关 |
| **个** | 1个 | 开关插座 |

---

## 测试方法 Testing

### 1. 测试标准单位工序 Test Standard Unit Processes

选择一个有预设单位的工序（如 N05_MEP_ROUGH 水电布管）：

1. 点击"开始工序"
2. 输入数量（如 100）
3. **检查**：界面应显示"单位: m²"
4. **检查**：计算结果应显示"100 m²"
5. 保存后刷新页面
6. **验证**：工序详情应显示"100 m²"，而不是其他单位

### 2. 测试计数单位 Test Count Units

选择柱子工序（如 STR-02-01 柱钢筋绑扎）：

1. 点击"开始工序"
2. 输入柱子数量（如 8）
3. **检查**：界面应显示"单位: 根"
4. **检查**：计算结果应显示"8 根"
5. **验证**：不应显示"8 个"或"8 m²"

### 3. 测试门窗单位 Test Door/Window Units

选择门窗工序（如 N13_DOOR_WINDOW）：

1. 输入门窗数量（如 12）
2. **检查**：单位应为"樘"
3. **验证**：不应为"个"或"套"

---

## 文件改动 Files Changed

### 修改的文件 Modified Files:
- ✅ `frontend/js/process-enhancements.js` - 修复单位处理逻辑
- ✅ `update-all-units.sql` - 设置所有65个工序的标准单位
- ✅ `PROCESS_UNITS_STANDARD.md` - 单位标准文档

### 数据库改动 Database Changes:
- ✅ 所有65个工序的 `quantity_unit` 字段已更新
- ✅ 单位设置基于建筑行业标准

---

## 影响范围 Impact

### ✅ 改善的功能 Improvements:
1. 工程量输入时显示正确的预设单位
2. 用户无法错误修改标准单位
3. 数据一致性提高
4. 符合建筑行业规范

### ⚠️ 需要注意 Cautions:
1. 已输入的旧数据单位可能不一致（需要数据迁移或手动修正）
2. 用户无法再自定义标准工序的单位（这是设计意图）

---

## 下一步 Next Steps

1. ✅ 测试所有工序类型的单位显示
2. ✅ 验证数据保存后单位不会被覆盖
3. 📋 规划材料自动生成功能（基于工序+数量+单位）
4. 📋 考虑添加单位换算功能（如果需要）

---

## 更新日期 Update Date
2026-10-11

## 版本 Version
v2.1 - 工程量单位完善版 Unit System Refinement
