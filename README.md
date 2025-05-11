# ThingsBoard 猪场管理系统改动记录

本文档记录了对猪场管理系统的所有代码改动。

## 改动历史

### 2023-XX-XX: 初始化项目
- 创建了基础的猪场管理系统结构

### 2023-XX-XX: 添加编辑功能
- 创建了 `edit_widget_examples_js` 和 `edit_widget_examples_html` 文件
- 实现了猪场信息编辑功能，包括基本信息和服务器属性
- 解决了表单验证和HTTP 400错误问题
- 增加了电子邮件验证功能

### 2023-XX-XX: 添加新增功能
- 创建了 `add_widget_examples_js` 和 `add_widget_examples_html` 文件
- 实现了添加猪场功能
- 包含表单验证和错误处理

### 2023-XX-XX: 添加删除功能
- 创建了 `delete_custom_action.js` 文件
- 实现了猪场删除功能，包括删除确认对话框
- 添加了成功/失败通知

## 文件结构

- `/root/thingsboard/docs/widget/edit_widget_examples_js` - 编辑功能的JavaScript代码
- `/root/thingsboard/docs/widget/edit_widget_examples_html` - 编辑功能的HTML模板
- `/root/thingsboard/docs/widget/add_widget_examples_js` - 添加功能的JavaScript代码
- `/root/thingsboard/docs/widget/add_widget_examples_html` - 添加功能的HTML模板
- `/root/thingsboard/docs/widget/delete_custom_action.js` - 删除功能的自定义动作代码

## 使用说明

### 编辑功能
编辑功能允许用户修改现有猪场的信息，包括名称、负责人、地理位置等。

### 添加功能
添加功能允许用户创建新的猪场，设置其基本信息和属性。

### 删除功能
删除功能允许用户删除不再需要的猪场，操作前会显示确认对话框。

## 注意事项

- 自定义动作代码需要复制到ThingsBoard平台中的部件自定义动作配置中
- 删除操作不可恢复，请谨慎操作
