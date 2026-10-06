const ctrl = require('./backend/src/controllers/simple-project.controller');
console.log('getProjects:', typeof ctrl.getProjects);
console.log('getProjectById:', typeof ctrl.getProjectById);
console.log('createProject:', typeof ctrl.createProject);
console.log('updateProject:', typeof ctrl.updateProject);
console.log('All keys:', Object.keys(ctrl));
