// API配置
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '';  // 生产环境使用相对路径，nginx会代理/api/*

// 存储token
let authToken = localStorage.getItem('authToken');

// API请求封装
async function apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (authToken && !endpoint.includes('/auth/login')) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                // Token过期，跳转登录
                localStorage.removeItem('authToken');
                window.location.reload();
            }
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// API方法
const api = {
    // 认证
    login: async (username, password) => {
        const data = await apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (data.success) {
            authToken = data.data.token;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        return data;
    },

    // 项目
    getProjects: () => apiRequest('/api/projects'),
    
    createProject: (projectData) => apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData)
    }),

    getProjectSummary: (projectId) => apiRequest(`/api/projects/${projectId}/summary`),

    // 工序
    getProcesses: (projectId) => apiRequest(`/api/projects/${projectId}/processes`),

    updateProcess: (processId, data) => apiRequest(`/api/processes/${processId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    // 材料
    getMaterials: (projectId, status) => {
        const query = status ? `?status=${status}` : '';
        return apiRequest(`/api/projects/${projectId}/materials${query}`);
    },

    recordMaterialUsage: (data) => apiRequest('/api/materials/usage', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    // 照片
    getPhotos: (projectId) => apiRequest(`/api/photos/project/${projectId}`),

    uploadPhoto: async (formData) => {
        // 照片上传使用FormData，不设置Content-Type
        const url = `${API_BASE}/api/photos/upload`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        return response.json();
    },

    // 每日进度
    getDailyTasks: (projectId) => apiRequest(`/api/projects/${projectId}/daily-tasks`),

    submitDailyProgress: (data) => apiRequest('/api/daily-progress', {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    getProgressHistory: (processExecutionId) => apiRequest(`/api/process-execution/${processExecutionId}/progress-history`),

    updateProcessPlan: (processExecutionId, data) => apiRequest(`/api/process-execution/${processExecutionId}/plan`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    updateProjectWorkers: (projectId, data) => apiRequest(`/api/projects/${projectId}/workers`, {
        method: 'PUT',
        body: JSON.stringify(data)
    })
};
