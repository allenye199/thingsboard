/*example from thingsboard.

var $injector = widgetContext.$scope.$injector;
var dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
var deviceService = $injector.get(widgetContext.servicesMap.get('deviceService'));

openDeleteDeviceDialog();

function openDeleteDeviceDialog() {
  var title = 'Are you sure you want to delete the device ' + entityName + '?';
  var content = 'Be careful, after the confirmation, the device and all related data will become unrecoverable!';
  dialogs.confirm(title, content, 'Cancel', 'Delete').subscribe(
    function(result) {
      if (result) {
        deleteDevice();
      }
    }
  );
}

function deleteDevice() {
  deviceService.deleteDevice(entityId.id).subscribe(
    function() {
      widgetContext.updateAliases();
    }
  );
}
*/

/*=======================================================================*/
/*=====  猪场删除功能 - 单元格按钮自定义动作  =====*/
/*=======================================================================*/

// 重要：确保在ThingsBoard环境中正确访问实体信息
// 直接访问全局变量而非$event
var $injector = widgetContext.$scope.$injector;
var dialogs = $injector.get(widgetContext.servicesMap.get('dialogs'));
var customerService = $injector.get(widgetContext.servicesMap.get('customerService'));

// 在自定义动作环境中，直接使用entityId和entityName
openDeleteCustomerDialog();

function openDeleteCustomerDialog() {
  var title = '删除确认';
  var content = '您确定要删除猪场 "' + entityName + '" 吗？';
  
  // 确保使用正确的dialogs服务
  dialogs.confirm(title, content, '取消', '删除').subscribe(
    function(result) {
      if (result) {
        deleteCustomer();
      }
    }
  );
}

function deleteCustomer() {
  console.log("尝试删除实体ID:", entityId.id);
  
  // 确保ID格式正确
  customerService.deleteCustomer(entityId.id).subscribe(
    function() {
      console.log("删除成功");
      widgetContext.updateAliases();
      widgetContext.showSuccessToast('猪场已成功删除!');
    },
    function(error) {
      console.error('删除失败:', error);
      widgetContext.showErrorToast('删除猪场失败: ' + ((error && error.data) ? error.data.message : '未知错误'));
    }
  );
}
