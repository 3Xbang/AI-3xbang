const fs = require('fs');
const path = require('path');

// 从 git 恢复原始文件（v15版本）
const { execSync } = require('child_process');
execSync('git checkout e1b9b8b -- frontend/js/process-enhancements.js', { cwd: __dirname });

const filePath = path.join(__dirname, 'frontend', 'js', 'process-enhancements.js');
let content = fs.readFileSync(filePath, 'utf8');

// 在文件最开头添加 getTexts 函数
const getTextsFunction = `// 工序进度页面增强功能
// Process Progress Page Enhancements

// 获取当前语言文本
function getProcessTexts() {
    const lang = localStorage.getItem('language') || 'zh';
    return lang === 'zh' ? {
        startProcess: '开始工序',
        updateProgress: '更新进度',
        pause: '暂停',
        complete: '完成',
        completed: '已完成',
        viewSubtasks: '查看子任务',
        collapseSubtasks: '收起子任务',
        quantity: '工程量',
        schedule: '计划',
        dependencies: '依赖',
        days: '天',
        loading: '加载中...',
        noSubtasks: '暂无子任务',
        createFromTemplate: '从模板创建子任务',
        subtaskList: '子任务列表',
        addMoreSubtasks: '+ 添加更多子任务',
        loadError: '加载失败',
        estimated: '预计',
        completed_qty: '已完成',
        recordProgress: '记录进度'
    } : {
        startProcess: 'เริ่มงาน',
        updateProgress: 'อัพเดทความคืบหน้า',
        pause: 'หยุดชั่วคราว',
        complete: 'เสร็จสิ้น',
        completed: 'เสร็จแล้ว',
        viewSubtasks: 'ดูงานย่อย',
        collapseSubtasks: 'ซ่อนงานย่อย',
        quantity: 'ปริมาณงาน',
        schedule: 'แผนงาน',
        dependencies: 'งานที่เกี่ยวข้อง',
        days: 'วัน',
        loading: 'กำลังโหลด...',
        noSubtasks: 'ยังไม่มีงานย่อย',
        createFromTemplate: 'สร้างจากเทมเพลต',
        subtaskList: 'รายการงานย่อย',
        addMoreSubtasks: '+ เพิ่มงานย่อย',
        loadError: 'โหลดไม่สำเร็จ',
        estimated: 'ประมาณการ',
        completed_qty: 'เสร็จแล้ว',
        recordProgress: 'บันทึกความคืบหน้า'
    };
}

`;

content = content.replace('// 工序进度页面增强功能\n// Process Progress Page Enhancements\n\n', getTextsFunction);

// 在 renderProcesses 函数开始添加 const t = getProcessTexts();
content = content.replace(
    'app.renderProcesses = function(processes) {\n        // 保存工序列表供其他函数使用\n        app._currentProcesses = processes || [];',
    'app.renderProcesses = function(processes) {\n        app._currentProcesses = processes || [];\n        const t = getProcessTexts();  // 获取当前语言文本'
);

// 替换所有按钮文本
const replacements = [
    { from: "${t('processes.startProcess')}", to: "${t.startProcess}" },
    { from: "${t('daily.updateProgress')}", to: "${t.updateProgress}" },
    { from: "${t('processes.pause')}", to: "${t.pause}" },
    { from: "${t('processes.complete')}", to: "${t.complete}" },
    { from: "${t('processes.completed')}", to: "${t.completed}" },
    { from: "${t('quantities.quantity')}", to: "${t.quantity}" },
    { from: "${t('daily.viewSubtasks')}", to: "${t.viewSubtasks}" },
    { from: "${t('scheduling.schedule')}", to: "${t.schedule}" },
    { from: "${t('scheduling.dependencies')}", to: "${t.dependencies}" },
    { from: "${t('scheduling.days')}", to: "${t.days}" },
    { from: "${t('common.loading')}", to: "${t.loading}" },
    { from: "${t('daily.noSubtasks')}", to: "${t.noSubtasks}" },
    { from: "${t('daily.createFromTemplate')}", to: "${t.createFromTemplate}" },
    { from: "${t('daily.subtaskList')}", to: "${t.subtaskList}" },
    { from: "${t('daily.addMoreSubtasks')}", to: "${t.addMoreSubtasks}" },
    { from: "${t('common.loadError')}", to: "${t.loadError}" },
    { from: "${t('daily.estimated')}", to: "${t.estimated}" },
    { from: "${t('daily.completed')}", to: "${t.completed_qty}" },
    { from: "${t('daily.recordProgress')}", to: "${t.recordProgress}" },
    { from: "t('daily.viewSubtasks') + ' ▼'", to: "t.viewSubtasks + ' ▼'" },
    { from: "t('daily.collapseSubtasks') + ' ▲'", to: "t.collapseSubtasks + ' ▲'" }
];

replacements.forEach(({ from, to }) => {
    content = content.replaceAll(from, to);
});

// 在 toggleSubtasksInline 函数开始添加 const t = getProcessTexts();
content = content.replace(
    'app.toggleSubtasksInline = async function(processExecutionId) {',
    'app.toggleSubtasksInline = async function(processExecutionId) {\n        const t = getProcessTexts();'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ process-enhancements.js 已修复完成');
