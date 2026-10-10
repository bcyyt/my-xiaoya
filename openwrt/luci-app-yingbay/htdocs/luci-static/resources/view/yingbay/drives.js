'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yingbay', _('网盘挂载'),
			_('挂到路由器上的云盘。Alist/OpenList 可承接 115、夸克、天翼等；阿里云盘填 refresh_token 走官方直链。保存后重启服务生效。'));

		s = m.section(form.TypedSection, 'drive', _('已挂载'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;

		o = s.option(form.Value, 'name', _('显示名'));
		o.placeholder = '客厅阿里云盘';
		o.rmempty = false;

		o = s.option(form.ListValue, 'type', _('类型'));
		o.value('demo', _('演示片库'));
		o.value('alist', _('Alist / OpenList'));
		o.value('aliyun', _('阿里云盘'));
		o.value('webdav', _('WebDAV'));
		o.value('local', _('本地 / USB'));

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.default = '1';

		o = s.option(form.Value, 'id', _('内部 ID'));
		o.placeholder = 'drv_home';

		o = s.option(form.Value, 'url', _('地址'));
		o.placeholder = 'http://127.0.0.1:5244';
		o.depends('type', 'alist');
		o.depends('type', 'webdav');

		o = s.option(form.Value, 'username', _('用户名'));
		o.depends('type', 'alist');
		o.depends('type', 'webdav');

		o = s.option(form.Value, 'password', _('密码'));
		o.password = true;
		o.depends('type', 'alist');
		o.depends('type', 'webdav');

		o = s.option(form.TextValue, 'refresh_token', _('refresh_token'));
		o.depends('type', 'aliyun');

		o = s.option(form.Value, 'root', _('本地路径'));
		o.placeholder = '/mnt/sda1/video';
		o.depends('type', 'local');

		o = s.option(form.Value, 'token', _('Alist Token'), _('可选。已有 token 时不必再填用户名密码。'));
		o.depends('type', 'alist');

		return m.render();
	}
});
