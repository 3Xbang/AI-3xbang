// API閰嶇疆
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '';  // 鐢熶骇鐜浣跨敤鐩稿璺緞锛宯ginx浼氫唬鐞?api/*

// 瀛樺偍token
let authToken = localStorage.getItem('authToken');

// API璇锋眰灏佽
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
                // Token杩囨湡锛岃烦杞櫥褰?
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

// API鏂规硶
const api = {
    // 璁よ瘉
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

    // 椤圭洰
    getProjects: () => apiRequest('/api/projects'),
    
    createProject: (projectData) => apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData)
    }),

    getProjectSummary: (projectId) => apiRequest(`/api/projects/${projectId}/summary`),

    // 工序管理
    processes: {
        // 获取工序列表
        getList: (projectId) => apiRequest(`/api/projects/${projectId}/processes`),
        
        // 更新工序
        update: (processId, data) => apiRequest(`/api/processes/${processId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    },

    // 材料管理
    materials: {
        // 获取材料列表
        getList: (projectId, status) => {
            const query = status ? `?status=${status}` : '';
            return apiRequest(`/api/projects/${projectId}/materials${query}`);
        },
        
        // 采购材料
        purchase: (data) => apiRequest('/api/materials', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        
        // 材料到货
        receive: (materialId, data) => apiRequest(`/api/materials/${materialId}/receive`, {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        
        // 使用材料
        use: (materialId, data) => apiRequest(`/api/materials/${materialId}/use`, {
            method: 'POST',
            body: JSON.stringify(data)
        })
    },

    // 材料库
    materialLibrary: {
        // 获取材料库列表
        getList: (category) => {
            const query = category ? `?category=${category}` : '';
            return apiRequest(`/api/material-library${query}`);
        },
        
        // 获取单个材料
        get: (code) => apiRequest(`/api/material-library/${code}`)
    },

    // 鐓х墖
    getPhotos: (projectId) => apiRequest(`/api/photos/project/${projectId}`),

    uploadPhoto: async (formData) => {
        // 鐓х墖涓婁紶浣跨敤FormData锛屼笉璁剧疆Content-Type
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

    // 姣忔棩杩涘害
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
    }),

    // 瀛愪换鍔?
    getSubtasks: (processExecutionId) => apiRequest(`/api/process-execution/${processExecutionId}/subtasks`),

    createSubtask: (processExecutionId, data) => apiRequest(`/api/process-execution/${processExecutionId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify(data)
    }),

    updateSubtask: (subtaskId, data) => apiRequest(`/api/subtasks/${subtaskId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),

    deleteSubtask: (subtaskId) => apiRequest(`/api/subtasks/${subtaskId}`, {
        method: 'DELETE'
    }),

    submitSubtaskProgress: (subtaskId, data) => apiRequest(`/api/subtasks/${subtaskId}/progress`, {
        method: 'POST',
        body: JSON.stringify(data)
    })
};
