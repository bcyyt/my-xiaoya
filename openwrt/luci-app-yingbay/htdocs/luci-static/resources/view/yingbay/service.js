'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yingbay', _('映湾服务'),
			_('控制 Node 服务监听端口。保存后会按 UCI 重新拉起映湾。手机访问 http://路由器IP:端口/'));

		s = m.section(form.NamedSection, 'main', 'service', _('基本设置'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Value, 'port', _('HTTP 端口'));
		o.datatype = 'port';
		o.placeholder = '3000';
		o.rmempty = false;

		o = s.option(form.Value, 'site_name', _('站点名称'));
		o.placeholder = '映湾';

		o = s.option(form.Value, 'workdir', _('安装目录'));
		o.placeholder = '/opt/yingbay';

		o = s.option(form.Value, 'pin', _('访问口令'), _('可选。给放映厅预留的 PIN，留空表示局域网内直接访问。'));
		o.password = true;

		return m.render();
	}
});
