# 计算公式文档 - 31个工序的完整定义

**版本**: 2.1  
**创建日期**: 2024-01-15

---

## 1. 计算公式体系

### 1.1 人工定额计算公式

```javascript
/**
 * 计算工序所需工人数量
 * @param {Object} processNode - 工序定义
 * @param {Object} baseData - 基础数据
 * @returns {Object} {count, formula, breakdown, total_work_days}
 */
function calculateWorkers(processNode, baseData) {
  const quota = processNode.worker_quota;
  
  // 1. 计算工作量
  let workload = 0;
  switch (quota.unit) {
    case 'm2':  // 按面积
      workload = baseData.area || (baseData.length * baseData.width);
      break;
    case 'm3':  // 按体积
      workload = baseData.volume || (baseData.length * baseData.width * baseData.depth);
      break;
    case 'm':   // 按长度
      workload = baseData.length;
      break;
    default:
      workload = 1;
  }
  
  // 2. 计算总工日 = 工作量 × 定额
  const totalWorkDays = workload * quota.labor_per_unit;
  
  // 3. 计算所需工人数 = 总工日 ÷ 预估工期
  const estimatedDays = processNode.estimated_days || 1;
  let workerCount = totalWorkDays / estimatedDays;
  
  // 4. 向上取整并应用约束
  workerCount = Math.ceil(workerCount);
  workerCount = Math.max(quota.min_workers || 1, workerCount);
  workerCount = Math.min(quota.max_workers || 20, workerCount);
  
  return {
    count: workerCount,
    formula: `工作量(${workload.toFixed(2)}${quota.unit}) × 定额(${quota.labor_per_unit}工日/${quota.unit}) ÷ 工期(${estimatedDays}天)`,
    breakdown: `${workload.toFixed(2)} × ${quota.labor_per_unit} ÷ ${estimatedDays} = ${workerCount}人`,
    total_work_days: Math.round(totalWorkDays * 100) / 100
  };
}
```

### 1.2 材料定额计算公式

```javascript
/**
 * 计算工序所需材料用量
 * @param {Object} processNode - 工序定义
 * @param {Object} baseData - 基础数据
 * @returns {Object} {materialCode: {quantity, unit, formula}}
 */
async function calculateMaterials(processNode, baseData) {
  const materials = {};
  const quotas = processNode.material_quotas || {};
  
  for (const [materialCode, quota] of Object.entries(quotas)) {
    // 1. 计算工作量
    let workload = 0;
    switch (quota.unit) {
      case 'm2':
        workload = baseData.area || (baseData.length * baseData.width);
        break;
      case 'm3':
        workload = baseData.volume || (baseData.length * baseData.width * baseData.depth);
        break;
      case 'm':
        workload = baseData.length;
        break;
      default:
        workload = 1;
    }
    
    // 2. 计算数量 = 工作量 × 定额 × (1 + 损耗率)
    const lossRate = quota.loss_rate || 0.03;  // 默认3%
    let quantity = workload * quota.quantity_per_unit * (1 + lossRate);
    
    // 3. 保留2位小数
    quantity = Math.ceil(quantity * 100) / 100;
    
    materials[materialCode] = {
      quantity,
      unit: quota.result_unit || 't',
      formula: `${workload.toFixed(2)}${quota.unit} × ${quota.quantity_per_unit} × (1 + ${(lossRate * 100).toFixed(0)}%)`,
      loss_rate: lossRate
    };
  }
  
  return materials;
}
```

---

## 2. 31个工序完整定义

### P001 - 地基开挖

**基础数据需求**:
```json
{
  "length": {"type": "number", "unit": "m", "label_zh": "长度", "label_th": "ความยาว", "label_en": "Length", "required": true, "min": 1, "max": 200},
  "width": {"type": "number", "unit": "m", "label_zh": "宽度", "label_th": "ความกว้าง", "label_en": "Width", "required": true, "min": 1, "max": 200},
  "depth": {"type": "number", "unit": "m", "label_zh": "深度", "label_th": "ความลึก", "label_en": "Depth", "required": true, "min": 0.5, "max": 10}
}
```

**人工定额**:
```json
{
  "unit": "m3",
  "labor_per_unit": 0.5,
  "min_workers": 3,
  "max_workers": 15,
  "productivity": 6.0,
  "description": "每立方米土方开挖需要0.5个工日"
}
```

**材料定额**:
```json
{
  "M001": {
    "quantity_per_unit": 0.05,
    "unit": "m3",
    "result_unit": "t",
    "loss_rate": 0.0,
    "description": "回填土（开挖体积的5%需回填）"
  }
}
```

**工具清单**: `["T001", "T002"]` (挖掘机、自卸车)

**计算示例**:
```javascript
// 输入：长50m、宽30m、深2m
const baseData = {length: 50, width: 30, depth: 2};
const volume = 50 * 30 * 2 = 3000; // m3

// 人工计算：
总工日 = 3000 * 0.5 = 1500工日
所需工人 = 1500 ÷ 3天 = 500人（超过max 15，取15人）

// 材料计算：
M001回填土 = 3000 * 0.05 * (1 + 0%) = 150 m3 = 150吨
```

---

### P002 - 地基浇筑

**基础数据需求**:
```json
{
  "length": {"type": "number", "unit": "m", "label_zh": "长度", "required": true, "min": 1, "max": 200},
  "width": {"type": "number", "unit": "m", "label_zh": "宽度", "required": true, "min": 1, "max": 200},
  "depth": {"type": "number", "unit": "m", "label_zh": "厚度", "required": true, "min": 0.2, "max": 2}
}
```

**人工定额**:
```json
{
  "unit": "m3",
  "labor_per_unit": 0.8,
  "min_workers": 4,
  "max_workers": 20,
  "productivity": 4.0,
  "description": "每立方米混凝土浇筑需0.8个工日"
}
```

**材料定额**:
```json
{
  "M001": {
    "quantity_per_unit": 0.35,
    "unit": "m3",
    "result_unit": "t",
    "loss_rate": 0.02,
    "description": "水泥（C30混凝土）"
  },
  "M002": {
    "quantity_per_unit": 0.65,
    "unit": "m3",
    "result_unit": "t",
    "loss_rate": 0.02,
    "description": "砂"
  },
  "M003": {
    "quantity_per_unit": 1.2,
    "unit": "m3",
    "result_unit": "t",
    "loss_rate": 0.02,
    "description": "碎石"
  },
  "M004": {
    "quantity_per_unit": 45,
    "unit": "m3",
    "result_unit": "kg",
    "loss_rate": 0.05,
    "description": "钢筋"
  }
}
```

**工具清单**: `["T003", "T004", "T005"]` (混凝土搅拌机、振捣器、运输车)

**计算示例**:
```javascript
// 输入：长50m、宽30m、厚0.3m
const baseData = {length: 50, width: 30, depth: 0.3};
const volume = 50 * 30 * 0.3 = 450; // m3

// 人工计算：
总工日 = 450 * 0.8 = 360工日
所需工人 = 360 ÷ 2天 = 180人（超过max 20，取20人）

// 材料计算：
M001水泥 = 450 * 0.35 * 1.02 = 160.65吨
M002砂 = 450 * 0.65 * 1.02 = 298.35吨
M003碎石 = 450 * 1.2 * 1.02 = 550.80吨
M004钢筋 = 450 * 45 * 1.05 = 21262.50公斤 = 21.26吨
```

---

### P003 - 主体框架

**基础数据需求**:
```json
{
  "floor_count": {"type": "number", "unit": "层", "label_zh": "楼层数", "required": true, "min": 1, "max": 5},
  "floor_area": {"type": "number", "unit": "m2", "label_zh": "每层面积", "required": true, "min": 50, "max": 5000}
}
```

**人工定额**:
```json
{
  "unit": "m2",
  "labor_per_unit": 1.2,
  "min_workers": 5,
  "max_workers": 25,
  "productivity": 25.0,
  "description": "每平方米框架结构需1.2个工日"
}
```

**材料定额**:
```json
{
  "M001": {
    "quantity_per_unit": 0.4,
    "unit": "m2",
    "result_unit": "t",
    "loss_rate": 0.02,
    "description": "水泥"
  },
  "M004": {
    "quantity_per_unit": 55,
    "unit": "m2",
    "result_unit": "kg",
    "loss_rate": 0.05,
    "description": "钢筋"
  },
  "M010": {
    "quantity_per_unit": 0.8,
    "unit": "m2",
    "result_unit": "m2",
    "loss_rate": 0.1,
    "description": "模板"
  }
}
```

**工具清单**: `["T003", "T004", "T006"]` (搅拌机、振捣器、钢筋切割机)

**计算示例**:
```javascript
// 输入：3层、每层150m2
const baseData = {floor_count: 3, floor_area: 150};
const totalArea = 3 * 150 = 450; // m2

// 人工计算：
总工日 = 450 * 1.2 = 540工日
所需工人 = 540 ÷ 5天 = 108人（超过max 25，取25人）

// 材料计算：
M001水泥 = 450 * 0.4 * 1.02 = 183.60吨
M004钢筋 = 450 * 55 * 1.05 = 25987.50公斤 = 25.99吨
M010模板 = 450 * 0.8 * 1.1 = 396.00平方米
```

---

### P004 - 屋面封顶

**基础数据需求**:
```json
{
  "roof_area": {"type": "number", "unit": "m2", "label_zh": "屋面面积", "required": true, "min": 50, "max": 2000}
}
```

**人工定额**:
```json
{
  "unit": "m2",
  "labor_per_unit": 0.6,
  "min_workers": 3,
  "max_workers": 12,
  "productivity": 40.0,
  "description": "每平方米屋面需0.6个工日"
}
```

**材料定额**:
```json
{
  "M001": {
    "quantity_per_unit": 0.15,
    "unit": "m2",
    "result_unit": "t",
    "loss_rate": 0.02,
    "description": "水泥"
  },
  "M011": {
    "quantity_per_unit": 1.0,
    "unit": "m2",
    "result_unit": "m2",
    "loss_rate": 0.05,
    "description": "屋面板"
  },
  "M012": {
    "quantity_per_unit": 3.5,
    "unit": "m2",
    "result_unit": "m",
    "loss_rate": 0.05,
    "description": "屋架木材"
  }
}
```

**工具清单**: `["T007", "T008"]` (电锯、钉枪)

---

### P005 - 水电布管

**基础数据需求**:
```json
{
  "total_area": {"type": "number", "unit": "m2", "label_zh": "建筑总面积", "required": true, "min": 50, "max": 5000}
}
```

**人工定额**:
```json
{
  "unit": "m2",
  "labor_per_unit": 0.4,
  "min_workers": 2,
  "max_workers": 10,
  "productivity": 60.0,
  "description": "每平方米水电布管需0.4个工日"
}
```

**材料定额**:
```json
{
  "M015": {
    "quantity_per_unit": 15,
    "unit": "m2",
    "result_unit": "m",
    "loss_rate": 0.1,
    "description": "PVC电线管"
  },
  "M016": {
    "quantity_per_unit": 8,
    "unit": "m2",
    "result_unit": "m",
    "loss_rate": 0.1,
    "description": "PPR水管"
  },
  "M017": {
    "quantity_per_unit": 60,
    "unit": "m2",
    "result_unit": "m",
    "loss_rate": 0.05,
    "description": "电线"
  }
}
```

**工具清单**: `["T009", "T010"]` (热熔机、开槽机)

**计算示例**:
```javascript
// 输入：总面积150m2
const baseData = {total_area: 150};

// 人工计算：
总工日 = 150 * 0.4 = 60工日
所需工人 = 60 ÷ 3天 = 20人（超过max 10，取10人）

// 材料计算：
M015电线管 = 150 * 15 * 1.1 = 2475米
M016水管 = 150 * 8 * 1.1 = 1320米
M017电线 = 150 * 60 * 1.05 = 9450米
```

---

## 3. 其余26个工序定义

**注**: 其余26个工序（P006-P031）遵循相同的定义结构，每个工序都包含：
- base_data_schema（基础数据需求）
- worker_quota（人工定额）
- material_quotas（材料定额）
- tool_codes（工具清单）
- estimated_days（预估工期）

完整的31个工序定义数据文件：
- **design-data-31-processes.json** - JSON格式，可直接导入数据库

---

## 4. 成本计算公式

### 4.1 计划成本计算

```javascript
/**
 * 计算项目计划成本
 * @param {Number} projectId
 * @returns {Object} {material, labor, total}
 */
async function calculatePlannedCost(projectId) {
  // 1. 查询所有已审批的工序记录
  const records = await db.query(`
    SELECT nr.*, pn.estimated_days
    FROM node_records nr
    JOIN process_nodes pn ON pn.id = nr.node_id
    WHERE nr.project_id = $1 AND nr.status = 'approved'
  `, [projectId]);
  
  let plannedMaterialCost = 0;
  let plannedLaborCost = 0;
  
  // 2. 汇总材料成本
  for (const record of records.rows) {
    const materials = record.calculated_materials || {};
    for (const [matCode, matData] of Object.entries(materials)) {
      const matInfo = await db.query(
        'SELECT unit_price FROM material_library WHERE material_code = $1',
        [matCode]
      );
      if (matInfo.rows.length > 0) {
        plannedMaterialCost += matData.quantity * matInfo.rows[0].unit_price;
      }
    }
  }
  
  // 3. 汇总人工成本
  const avgWage = await db.query(
    'SELECT AVG(daily_wage) as avg FROM workers WHERE project_id = $1',
    [projectId]
  );
  const averageDailyWage = avgWage.rows[0]?.avg || 500;  // 默认500泰铢
  
  for (const record of records.rows) {
    const workers = record.calculated_workers || {};
    const workerCount = workers.count || 0;
    const days = record.estimated_days || 1;
    plannedLaborCost += workerCount * averageDailyWage * days;
  }
  
  return {
    material: Math.round(plannedMaterialCost * 100) / 100,
    labor: Math.round(plannedLaborCost * 100) / 100,
    total: Math.round((plannedMaterialCost + plannedLaborCost) * 100) / 100
  };
}
```

### 4.2 实际成本计算

```javascript
/**
 * 计算项目实际成本
 * @param {Number} projectId
 * @returns {Object} {material, labor, total}
 */
async function calculateActualCost(projectId) {
  // 1. 实际材料成本
  const materialResult = await db.query(`
    SELECT COALESCE(SUM(mr.quantity * ml.unit_price), 0) as total
    FROM material_records mr
    LEFT JOIN material_library ml ON ml.material_code = mr.material_code
    WHERE mr.project_id = $1 AND mr.status = 'approved'
  `, [projectId]);
  const actualMaterialCost = Number(materialResult.rows[0].total);
  
  // 2. 实际人工成本
  const laborResult = await db.query(`
    SELECT COALESCE(SUM(w.daily_wage), 0) as total
    FROM daily_attendance da
    JOIN workers w ON w.id = da.worker_id
    WHERE da.project_id = $1 AND da.status = 'present'
  `, [projectId]);
  const actualLaborCost = Number(laborResult.rows[0].total);
  
  return {
    material: Math.round(actualMaterialCost * 100) / 100,
    labor: Math.round(actualLaborCost * 100) / 100,
    total: Math.round((actualMaterialCost + actualLaborCost) * 100) / 100
  };
}
```

### 4.3 成本对比与偏差

```javascript
/**
 * 计算成本偏差
 * @param {Number} projectId
 * @returns {Object} {planned, actual, variance, needsAttention}
 */
async function calculateCostVariance(projectId) {
  const planned = await calculatePlannedCost(projectId);
  const actual = await calculateActualCost(projectId);
  
  const variance = {
    material: actual.material - planned.material,
    labor: actual.labor - planned.labor,
    total: actual.total - planned.total
  };
  
  const variancePercentage = {
    material: planned.material > 0 ? (variance.material / planned.material * 100) : 0,
    labor: planned.labor > 0 ? (variance.labor / planned.labor * 100) : 0,
    total: planned.total > 0 ? (variance.total / planned.total * 100) : 0
  };
  
  return {
    currency: 'THB',
    planned,
    actual,
    variance: {
      material: Math.round(variance.material * 100) / 100,
      labor: Math.round(variance.labor * 100) / 100,
      total: Math.round(variance.total * 100) / 100,
      percentage: Math.round(variancePercentage.total * 100) / 100
    },
    needsAttention: Math.abs(variancePercentage.total) > 10
  };
}
```

---

## 5. 每日资源需求计算

```javascript
/**
 * 计算指定日期的资源需求
 * @param {Number} projectId
 * @param {String} date - 'YYYY-MM-DD'
 * @returns {Object} {workers_needed, materials_needed, tools_needed}
 */
async function calculateDailyResources(projectId, date) {
  // 查询当天进行中的工序（已审批且在预估工期内）
  const processes = await db.query(`
    SELECT nr.*, pn.name_i18n, pn.node_code, pn.tool_codes
    FROM node_records nr
    JOIN process_nodes pn ON pn.id = nr.node_id
    WHERE nr.project_id = $1
      AND nr.status = 'approved'
      AND $2::date BETWEEN nr.confirmed_at::date 
          AND (nr.confirmed_at + pn.estimated_days * INTERVAL '1 day')::date
  `, [projectId, date]);
  
  let totalWorkers = 0;
  const materialMap = {};
  const toolSet = new Set();
  
  for (const proc of processes.rows) {
    // 汇总工人
    totalWorkers += (proc.calculated_workers?.count || 0);
    
    // 汇总材料
    for (const [matCode, matData] of Object.entries(proc.calculated_materials || {})) {
      materialMap[matCode] = (materialMap[matCode] || 0) + matData.quantity;
    }
    
    // 汇总工具
    (proc.tool_codes || []).forEach(code => toolSet.add(code));
  }
  
  // 查询材料名称
  const materials = [];
  for (const [code, qty] of Object.entries(materialMap)) {
    const mat = await db.query(
      'SELECT name_i18n, unit_i18n FROM material_library WHERE material_code = $1',
      [code]
    );
    if (mat.rows.length > 0) {
      materials.push({
        material_code: code,
        name_i18n: mat.rows[0].name_i18n,
        quantity: Math.round(qty * 100) / 100,
        unit_i18n: mat.rows[0].unit_i18n
      });
    }
  }
  
  // 查询工具名称
  const tools = [];
  for (const code of toolSet) {
    const tool = await db.query(
      'SELECT name_i18n, unit_i18n FROM tool_library WHERE tool_code = $1',
      [code]
    );
    if (tool.rows.length > 0) {
      tools.push({
        tool_code: code,
        name_i18n: tool.rows[0].name_i18n,
        quantity: 1  // 简化：每种工具数量为1
      });
    }
  }
  
  return {
    project_id: projectId,
    date,
    workers_needed: totalWorkers,
    active_processes: processes.rows.map(p => p.node_code),
    materials_needed: materials,
    tools_needed: tools
  };
}
```

---

## 6. 验证与测试

### 6.1 单元测试示例

```javascript
// tests/unit/calculate.test.js
const { calculateWorkers, calculateMaterials } = require('../../backend/src/services/process.service');

describe('calculateWorkers', () => {
  it('P001地基开挖：按体积计算', () => {
    const processNode = {
      worker_quota: {
        unit: 'm3',
        labor_per_unit: 0.5,
        min_workers: 3,
        max_workers: 15
      },
      estimated_days: 3
    };
    const baseData = {length: 50, width: 30, depth: 2, volume: 3000};
    
    const result = calculateWorkers(processNode, baseData);
    
    expect(result.count).to.equal(15);  // 3000*0.5/3=500，超过max15
    expect(result.total_work_days).to.equal(1500);
  });
  
  it('P005水电布管：按面积计算', () => {
    const processNode = {
      worker_quota: {
        unit: 'm2',
        labor_per_unit: 0.4,
        min_workers: 2,
        max_workers: 10
      },
      estimated_days: 3
    };
    const baseData = {total_area: 150, area: 150};
    
    const result = calculateWorkers(processNode, baseData);
    
    expect(result.count).to.equal(10);  // 150*0.4/3=20，超过max10
  });
});

describe('calculateMaterials', () => {
  it('P002地基浇筑：材料计算正确', async () => {
    const processNode = {
      material_quotas: {
        'M001': {quantity_per_unit: 0.35, unit: 'm3', result_unit: 't', loss_rate: 0.02},
        'M002': {quantity_per_unit: 0.65, unit: 'm3', result_unit: 't', loss_rate: 0.02}
      }
    };
    const baseData = {length: 50, width: 30, depth: 0.3, volume: 450};
    
    const result = await calculateMaterials(processNode, baseData);
    
    expect(result.M001.quantity).to.be.closeTo(160.65, 0.01);  // 450*0.35*1.02
    expect(result.M002.quantity).to.be.closeTo(298.35, 0.01);  // 450*0.65*1.02
  });
});
```

---

**文档结束**

**注**: 完整的31个工序定义请参见 **design-data-31-processes.json** 文件。
