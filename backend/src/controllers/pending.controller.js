/**
 * 待确认列表控制器（汇总节点和材料）
 */

const nodeService = require('../services/node.service');
const materialService = require('../services/material.service');
const ResponseUtil = require('../utils/response');

class PendingController {
  /**
   * 获取所有待确认项（节点 + 材料）
   * GET /api/pending/all
   */
  async getAllPending(req, res, next) {
    try {
      const projectId = req.user.projectId;
      
      // 并行查询节点和材料
      const [nodes, materials] = await Promise.all([
        nodeService.getPendingNodes(projectId),
        materialService.getPendingMaterials(projectId)
      ]);
      
      // 标记类型
      const nodesWithType = nodes.map(node => ({
        ...node,
        type: 'node',
        title: node.node_name
      }));
      
      const materialsWithType = materials.map(material => ({
        ...material,
        type: 'material',
        title: `${material.material_name} ${material.quantity}${material.unit}`
      }));
      
      // 合并并按时间倒序排列
      const all = [...nodesWithType, ...materialsWithType]
        .sort((a, b) => new Date(b.submit_time) - new Date(a.submit_time));
      
      res.json(ResponseUtil.success({
        nodes: nodesWithType,
        materials: materialsWithType,
        all,
        total: all.length,
        nodeCount: nodes.length,
        materialCount: materials.length
      }));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PendingController();
