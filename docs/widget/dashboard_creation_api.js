/**
 * ThingsBoard REST API仪表板创建示例
 * 
 * 该文件展示了如何通过REST API创建与现有仪表板相同的仪表板
 */

// 1. 获取源仪表板数据
// GET /api/dashboard/{dashboardId}
// 这会返回完整的仪表板对象，包括配置和布局

// 示例: 获取源仪表板
const fetchSourceDashboard = async (dashboardId, token) => {
  const response = await fetch(`http://localhost:8080/api/dashboard/${dashboardId}`, {
    headers: {
      'X-Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};

// 2. 修改仪表板数据以创建新实例
const prepareDashboardCopy = (sourceDashboard) => {
  // 创建深拷贝
  const dashboardCopy = JSON.parse(JSON.stringify(sourceDashboard));
  
  // 移除ID，这样ThingsBoard会创建新仪表板而不是更新现有仪表板
  delete dashboardCopy.id;
  
  // 修改标题以区分
  dashboardCopy.title = `${sourceDashboard.title} - 复制版`;
  
  // 保留或调整其他属性
  // dashboardCopy.configuration - 包含所有小部件和布局
  // dashboardCopy.assignedCustomers - 分配给的客户
  
  return dashboardCopy;
};

// 3. 创建新仪表板
// POST /api/dashboard
const createDashboard = async (dashboardData, token) => {
  const response = await fetch('http://localhost:8080/api/dashboard', {
    method: 'POST',
    headers: {
      'X-Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dashboardData)
  });
  return await response.json();
};

// 主函数：完整流程
const cloneDashboard = async (sourceDashboardId, token) => {
  try {
    // 1. 获取源仪表板
    const sourceDashboard = await fetchSourceDashboard(sourceDashboardId, token);
    console.log(`获取到源仪表板: ${sourceDashboard.title}`);
    
    // 2. 准备新仪表板数据
    const newDashboardData = prepareDashboardCopy(sourceDashboard);
    
    // 3. 创建新仪表板
    const createdDashboard = await createDashboard(newDashboardData, token);
    console.log(`成功创建仪表板副本: ${createdDashboard.title} (ID: ${createdDashboard.id.id})`);
    
    return createdDashboard;
  } catch (error) {
    console.error('克隆仪表板失败:', error);
    throw error;
  }
};

// 使用方法示例
// cloneDashboard('your-dashboard-id', 'your-jwt-token').then(dashboard => console.log(dashboard));
