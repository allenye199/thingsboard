/*
 * 仪表板克隆工具 - 将现有仪表板复制为新仪表板
 * 用途：在自定义动作按钮中快速复制仪表板
 */

// 获取必要的服务
var $injector = widgetContext.$scope.$injector;
var dashboardService = $injector.get(widgetContext.servicesMap.get('dashboardService'));
var dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
var $q = $injector.get('$q');

// 当前仪表板ID，可以替换为你想要复制的特定仪表板ID
var sourceDashboardId = entityId.id; // 如果在仪表板表格中使用，则为当前选中的仪表板ID

// 克隆仪表板的主函数
function cloneDashboard() {
  // 显示进度对话框
  var progressDialog = showProgressDialog();
  
  // 获取源仪表板详情
  dashboardService.getDashboard(sourceDashboardId).subscribe(
    function(sourceDashboard) {
      // 生成新仪表板数据
      var newDashboard = prepareNewDashboard(sourceDashboard);
      
      // 保存新仪表板
      dashboardService.saveDashboard(newDashboard).subscribe(
        function(savedDashboard) {
          progressDialog.close();
          showSuccessDialog(savedDashboard);
          widgetContext.updateAliases();
        },
        function(error) {
          progressDialog.close();
          handleError(error, '保存新仪表板失败');
        }
      );
    },
    function(error) {
      progressDialog.close();
      handleError(error, '获取源仪表板失败');
    }
  );
}

// 准备新仪表板数据，移除ID并修改名称
function prepareNewDashboard(sourceDashboard) {
  var newDashboard = angular.copy(sourceDashboard);
  
  // 移除ID以便创建新仪表板而不是更新现有仪表板
  delete newDashboard.id;
  
  // 添加后缀以区分副本
  var timestamp = new Date().toLocaleString().replace(/[/:]/g, '_');
  newDashboard.title = newDashboard.title + ' - 副本 (' + timestamp + ')';
  
  // 确保保留原始标签，如果有的话
  if (!newDashboard.tags) {
    newDashboard.tags = [];
  }
  
  // 可以添加克隆标记
  newDashboard.tags.push('cloned');
  
  return newDashboard;
}

// 显示进度对话框
function showProgressDialog() {
  return dialogs.customDialog({
    title: '克隆仪表板',
    message: '正在创建仪表板副本，请稍候...',
    showCancel: false,
    closeOnEsc: false,
    closeOnBackdrop: false
  });
}

// 显示成功对话框并提供打开新仪表板的选项
function showSuccessDialog(dashboard) {
  var title = '仪表板克隆成功';
  var content = '已成功创建仪表板 "' + dashboard.title + '"';
  
  dialogs.confirm(title, content, '关闭', '打开新仪表板').subscribe(
    function(result) {
      if (result) {
        // 打开新仪表板
        widgetContext.$scope.$injector.get('$window').open('/dashboards/' + dashboard.id.id, '_blank');
      }
    }
  );
}

// 错误处理
function handleError(error, defaultMsg) {
  var errorMsg = defaultMsg;
  if (error && error.data && error.data.message) {
    errorMsg += ': ' + error.data.message;
  }
  
  widgetContext.showErrorToast(errorMsg);
  console.error(errorMsg, error);
}

// 执行克隆操作
cloneDashboard();
