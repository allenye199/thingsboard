/**
 * ThingsBoard 租户仪表板复制工具
 * 功能：将一个租户的仪表板复制到另一个新租户
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置参数
const config = {
  tbUrl: 'http://localhost:8080',
  adminUsername: 'sysadmin@thingsboard.org',  // 系统管理员账户
  adminPassword: 'sysadmin',
  
  // 源租户和目标租户
  sourceTenantId: 'SOURCE_TENANT_ID',  // 替换为源租户ID
  targetTenantId: 'TARGET_TENANT_ID',  // 替换为目标租户ID
  
  // 临时目录，用于存储导出的仪表板
  tempDir: './temp_dashboards',
  
  // 标签处理
  preserveTags: true,           // 保留原有标签
  addCopyTag: true,             // 是否添加复制标记
};

// 主函数
async function copyDashboardsBetweenTenants() {
  try {
    // 1. 创建临时目录
    if (!fs.existsSync(config.tempDir)) {
      fs.mkdirSync(config.tempDir, { recursive: true });
    }
    
    // 2. 系统管理员登录
    console.log('正在以系统管理员身份登录...');
    const adminToken = await login(config.adminUsername, config.adminPassword);
    
    // 3. 获取源租户的所有仪表板
    console.log(`正在获取源租户 ${config.sourceTenantId} 的所有仪表板...`);
    const dashboards = await fetchTenantDashboards(config.sourceTenantId, adminToken);
    console.log(`找到 ${dashboards.length} 个仪表板`);
    
    // 4. 导出源租户的所有仪表板
    console.log('开始导出仪表板...');
    const exportedDashboards = [];
    for (const dashboard of dashboards) {
      try {
        const dashboardDetails = await fetchDashboardDetails(dashboard.id.id, adminToken);
        const filePath = path.join(config.tempDir, `${dashboard.title.replace(/[\/\\?%*:|"<>]/g, '_')}.json`);
        fs.writeFileSync(filePath, JSON.stringify(dashboardDetails, null, 2));
        console.log(`✅ 导出仪表板: ${dashboard.title}`);
        exportedDashboards.push({
          title: dashboard.title,
          path: filePath,
          data: dashboardDetails
        });
      } catch (error) {
        console.error(`❌ 导出仪表板 ${dashboard.title} 失败:`, error.message);
      }
    }
    
    // 5. 导入仪表板到目标租户
    console.log(`开始将仪表板导入到目标租户 ${config.targetTenantId}...`);
    for (const dashboard of exportedDashboards) {
      try {
        // 准备要导入的仪表板数据
        const dashboardToImport = prepareForImport(dashboard.data, config.targetTenantId);
        
        // 导入到目标租户
        const importedDashboard = await importDashboard(dashboardToImport, adminToken);
        console.log(`✅ 导入仪表板: ${importedDashboard.title} (ID: ${importedDashboard.id.id})`);
      } catch (error) {
        console.error(`❌ 导入仪表板 ${dashboard.title} 失败:`, error.message);
      }
    }
    
    console.log('\n仪表板复制完成!');
    
  } catch (error) {
    console.error('操作失败:', error.message);
  }
}

// 登录并获取令牌
async function login(username, password) {
  try {
    const response = await axios.post(`${config.tbUrl}/api/auth/login`, { username, password });
    return response.data.token;
  } catch (error) {
    throw new Error(`登录失败: ${error.response?.data?.message || error.message}`);
  }
}

// 获取租户的所有仪表板
async function fetchTenantDashboards(tenantId, token) {
  const dashboards = [];
  let hasNext = true;
  let page = 0;
  
  while (hasNext) {
    try {
      const response = await axios.get(
        `${config.tbUrl}/api/tenant/${tenantId}/dashboards?pageSize=100&page=${page}`,
        { headers: { 'X-Authorization': `Bearer ${token}` } }
      );
      
      const pageData = response.data;
      if (pageData.data && pageData.data.length > 0) {
        dashboards.push(...pageData.data);
        hasNext = pageData.hasNext;
        page++;
      } else {
        hasNext = false;
      }
    } catch (error) {
      throw new Error(`获取仪表板列表失败: ${error.response?.data?.message || error.message}`);
    }
  }
  
  return dashboards;
}

// 获取仪表板详情
async function fetchDashboardDetails(dashboardId, token) {
  try {
    const response = await axios.get(
      `${config.tbUrl}/api/dashboard/${dashboardId}?inlineImages=true`,
      { headers: { 'X-Authorization': `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    throw new Error(`获取仪表板详情失败: ${error.response?.data?.message || error.message}`);
  }
}

// 准备导入的仪表板数据
function prepareForImport(dashboard, targetTenantId) {
  // 创建深拷贝
  const newDashboard = JSON.parse(JSON.stringify(dashboard));
  
  // 移除ID，这样会创建新实例而不是更新现有实例
  delete newDashboard.id;
  
  // 设置目标租户ID
  if (targetTenantId) {
    newDashboard.tenantId = {
      entityType: "TENANT",
      id: targetTenantId
    };
  }
  
  // 处理标签
  if (!config.preserveTags) {
    newDashboard.tags = [];
  } else if (!newDashboard.tags) {
    newDashboard.tags = [];
  }
  
  // 添加复制标记
  if (config.addCopyTag) {
    newDashboard.tags.push('copied-dashboard');
  }
  
  return newDashboard;
}

// 导入仪表板
async function importDashboard(dashboardData, token) {
  try {
    const response = await axios.post(
      `${config.tbUrl}/api/dashboard`,
      dashboardData,
      { headers: { 'X-Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    throw new Error(`导入仪表板失败: ${error.response?.data?.message || error.message}`);
  }
}

// 执行主函数
copyDashboardsBetweenTenants();
