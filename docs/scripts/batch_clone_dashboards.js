/**
 * ThingsBoard 仪表板批量克隆工具
 * 用法: node batch_clone_dashboards.js <源仪表板ID> <副本数量> <令牌>
 */

const axios = require('axios');
const TB_URL = 'http://localhost:8080'; // ThingsBoard URL

// 命令行参数
const args = process.argv.slice(2);
const sourceDashboardId = args[0];
const cloneCount = parseInt(args[1] || '1');
const token = args[2]; // JWT令牌

if (!sourceDashboardId || !token) {
  console.error('用法: node batch_clone_dashboards.js <源仪表板ID> <副本数量> <令牌>');
  process.exit(1);
}

// API客户端
const api = axios.create({
  baseURL: TB_URL,
  headers: {
    'X-Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// 主函数
async function batchCloneDashboards() {
  try {
    console.log(`开始克隆仪表板 ${sourceDashboardId}, 副本数量: ${cloneCount}`);
    
    // 获取源仪表板
    const sourceDashboardResponse = await api.get(`/api/dashboard/${sourceDashboardId}`);
    const sourceDashboard = sourceDashboardResponse.data;
    console.log(`获取到源仪表板: "${sourceDashboard.title}"`);
    
    // 创建多个副本
    const createdDashboards = [];
    for (let i = 0; i < cloneCount; i++) {
      const newDashboard = prepareNewDashboard(sourceDashboard, i + 1);
      const response = await api.post('/api/dashboard', newDashboard);
      createdDashboards.push(response.data);
      console.log(`已创建副本 ${i+1}/${cloneCount}: "${response.data.title}" (ID: ${response.data.id.id})`);
    }
    
    console.log('\n克隆操作完成!');
    console.log('创建的仪表板:');
    createdDashboards.forEach((dashboard, idx) => {
      console.log(`${idx+1}. "${dashboard.title}" - ID: ${dashboard.id.id}`);
    });
    
    return createdDashboards;
  } catch (error) {
    console.error('克隆仪表板时出错:', error.response?.data?.message || error.message);
    process.exit(1);
  }
}

// 准备新仪表板数据
function prepareNewDashboard(sourceDashboard, index) {
  const newDashboard = { ...sourceDashboard };
  
  // 移除ID
  delete newDashboard.id;
  
  // 更新标题
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  newDashboard.title = `${sourceDashboard.title} - 副本 ${index} (${timestamp})`;
  
  // 确保保留标签
  if (!newDashboard.tags) {
    newDashboard.tags = [];
  }
  
  // 可选：添加克隆标签
  newDashboard.tags.push('auto-cloned');
  
  return newDashboard;
}

// 执行脚本
batchCloneDashboards();
