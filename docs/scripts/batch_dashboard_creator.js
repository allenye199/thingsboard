/**
 * ThingsBoard 仪表板批量创建工具
 * 功能：从已导出的仪表板JSON文件批量创建仪表板
 * 用法：将此脚本保存为JS文件并用Node.js执行
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 配置参数
const CONFIG = {
  // ThingsBoard服务器配置
  tbUrl: 'http://localhost:8080',
  username: 'tenant@thingsboard.org', // 更改为你的用户名
  password: 'tenant',                 // 更改为你的密码
  
  // 仪表板文件配置
  dashboardDir: './exported_dashboards', // 存放导出仪表板JSON文件的目录
  suffix: '-复制',                     // 添加到新仪表板名称后的后缀
  
  // 标签配置
  addTag: 'auto-created',             // 添加到所有创建的仪表板的标签
  preserveTags: true,                 // 是否保留原有标签
  
  // 复制选项
  copies: 1,                          // 每个仪表板创建的副本数量
  
  // 租户ID (可选，如果要将仪表板分配给特定租户)
  // targetTenantId: '8a77c050-2310-11ee-8485-371577a4488f'
};

// 主函数
async function batchCreateDashboards() {
  try {
    // 1. 登录获取令牌
    console.log('正在登录ThingsBoard获取授权令牌...');
    const token = await login(CONFIG.username, CONFIG.password);
    console.log('登录成功!');
    
    // 2. 读取仪表板目录
    console.log(`正在从 ${CONFIG.dashboardDir} 读取仪表板文件...`);
    const files = fs.readdirSync(CONFIG.dashboardDir)
                   .filter(file => file.endsWith('.json'));
    
    if (files.length === 0) {
      console.error('没有找到JSON文件!');
      return;
    }
    
    console.log(`找到 ${files.length} 个仪表板文件`);
    
    // 3. 批量创建仪表板
    let createdCount = 0;
    
    for (const file of files) {
      const filePath = path.join(CONFIG.dashboardDir, file);
      console.log(`处理文件: ${file}`);
      
      try {
        // 读取并解析仪表板JSON
        const dashboardJson = fs.readFileSync(filePath, 'utf8');
        let dashboard = JSON.parse(dashboardJson);
        
        // 创建指定数量的副本
        for (let i = 0; i < CONFIG.copies; i++) {
          const newDashboard = prepareNewDashboard(dashboard, i+1);
          const result = await createDashboard(newDashboard, token);
          
          console.log(`✅ 成功创建: "${result.title}" (ID: ${result.id.id})`);
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ 处理 ${file} 失败:`, error.message);
      }
    }
    
    console.log(`\n批量创建完成! 成功创建 ${createdCount} 个仪表板`);
    
  } catch (error) {
    console.error('批量创建过程中发生错误:', error.message);
  }
}

// 登录并获取JWT令牌
async function login(username, password) {
  try {
    const response = await axios.post(`${CONFIG.tbUrl}/api/auth/login`, {
      username,
      password
    });
    
    return response.data.token;
  } catch (error) {
    throw new Error(`登录失败: ${error.response?.data?.message || error.message}`);
  }
}

// 准备新仪表板数据
function prepareNewDashboard(sourceDashboard, copyIndex) {
  // 创建深拷贝
  const dashboard = JSON.parse(JSON.stringify(sourceDashboard));
  
  // 移除ID，这样会创建新实例而不是更新现有实例
  if (dashboard.id) {
    delete dashboard.id;
  }
  
  // 修改标题
  if (copyIndex > 1) {
    dashboard.title = `${dashboard.title}${CONFIG.suffix} ${copyIndex}`;
  } else {
    dashboard.title = `${dashboard.title}${CONFIG.suffix}`;
  }
  
  // 处理标签
  if (!dashboard.tags) {
    dashboard.tags = [];
  }
  
  if (!CONFIG.preserveTags) {
    dashboard.tags = [];
  }
  
  // 添加自动创建标签
  if (CONFIG.addTag && !dashboard.tags.includes(CONFIG.addTag)) {
    dashboard.tags.push(CONFIG.addTag);
  }
  
  // 如果指定了目标租户ID，则设置租户ID
  if (CONFIG.targetTenantId) {
    dashboard.tenantId = {
      entityType: "TENANT",
      id: CONFIG.targetTenantId
    };
  }
  
  return dashboard;
}

// 创建仪表板
async function createDashboard(dashboard, token) {
  try {
    const response = await axios.post(
      `${CONFIG.tbUrl}/api/dashboard`, 
      dashboard, 
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    throw new Error(`创建仪表板失败: ${error.response?.data?.message || error.message}`);
  }
}

// 执行主函数
batchCreateDashboards();
