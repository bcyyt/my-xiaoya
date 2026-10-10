'use strict';
'require view';
'require form';
'require rpc';
'require ui';

var callAuth = rpc.declare({
	object: 'luci.yingbay',
	method: 'auth',
	expect: {}
});

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yingbay', _('IPTV 中兴平台'),
			_('填写与机顶盒相同的 UserID、密码、MAC、STBID。保存并应用后，可点下方按钮向平台鉴权并拉取频道 / EPG。组播由内置 rtp2http 转 HTTP。'));

		s = m.section(form.NamedSection, 'iptv', 'iptv', _('鉴权参数'));
		s.addremove = false;

		o = s.option(form.ListValue, 'vendor', _('平台算法'));
		o.value('zte', _('中兴 MD5'));
		o.value('zte-sha', _('中兴 SHA256'));
		o.value('hwctc', _('华为 CTC'));

		o = s.option(form.Value, 'auth_url', _('AuthenticationURL'));
		o.placeholder = 'http://xxx:8082/EDS/jsp/AuthenticationURL';

		o = s.option(form.Value, 'epg_url', _('EPG 根地址'));
		o.placeholder = 'http://epg-host:port';

		o = s.option(form.Value, 'user_id', _('UserID'));
		o = s.option(form.Value, 'password', _('密码'));
		o.password = true;
		o = s.option(form.Value, 'mac', _('MAC'));
		o.placeholder = '00:11:22:33:44:55';
		o = s.option(form.Value, 'stb_id', _('STBID'));
		o = s.option(form.Value, 'user_ip', _('机顶盒 IP'));

		o = s.option(form.ListValue, 'play_mode', _('组播出口'));
		o.value('rtp2http', _('内置 rtp2http'));
		o.value('udpxy', _('已有 udpxy'));

		o = s.option(form.Value, 'udpxy_url', _('udpxy 地址'));
		o.placeholder = 'http://192.168.1.1:4022';
		o.depends('play_mode', 'udpxy');

		o = s.option(form.Value, 'epg_xml_url', _('外部 XMLTV'));
		o.placeholder = 'http://.../xmltv.xml';

		o = s.option(form.Button, '_auth', _('立即鉴权'));
		o.inputtitle = _('保存配置后向中兴平台登录并拉频道');
		o.inputstyle = 'apply';
		o.onclick = function() {
			return callAuth().then(function(res) {
				var text = (res && res.result) || JSON.stringify(res || {});
				ui.addNotification(null, E('pre', { 'style': 'white-space:pre-wrap' }, text), 'info');
			}).catch(function(err) {
				ui.addNotification(null, E('p', err.message || String(err)), 'error');
			});
		};

		return m.render();
	}
});
