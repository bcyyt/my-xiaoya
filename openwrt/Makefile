include $(TOPDIR)/rules.mk

PKG_NAME:=yingbay
PKG_VERSION:=1.1.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

YINGBAY_ROOT:=$(abspath $(CURDIR)/..)

define Package/yingbay
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=YingBay media center (cloud + IPTV)
  DEPENDS:=+node
  PKGARCH:=all
endef

define Package/yingbay/description
  Cloud-drive direct play, ZTE IPTV auth/EPG and rtp2http for phones.
endef

define Package/yingbay/conffiles
/etc/config/yingbay
endef

define Build/Compile
endef

define Package/yingbay/install
	$(INSTALL_DIR) $(1)/opt/yingbay/server $(1)/opt/yingbay/web $(1)/opt/yingbay/node_modules
	$(CP) $(YINGBAY_ROOT)/server/*.js $(1)/opt/yingbay/server/
	$(CP) $(YINGBAY_ROOT)/web/dist $(1)/opt/yingbay/web/
	$(CP) $(YINGBAY_ROOT)/package.json $(1)/opt/yingbay/
	$(CP) $(YINGBAY_ROOT)/node_modules/fast-xml-parser $(1)/opt/yingbay/node_modules/
	$(CP) $(YINGBAY_ROOT)/node_modules/strnum $(1)/opt/yingbay/node_modules/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/yingbay.init $(1)/etc/init.d/yingbay
	$(INSTALL_DIR) $(1)/etc/config $(1)/usr/share/yingbay $(1)/etc/uci-defaults
	$(INSTALL_CONF) ./files/yingbay.config $(1)/etc/config/yingbay
	$(INSTALL_DATA) ./files/yingbay.config $(1)/usr/share/yingbay/yingbay.config
	$(INSTALL_BIN) ./files/yingbay.uci-defaults $(1)/etc/uci-defaults/80_yingbay
endef

$(eval $(call BuildPackage,yingbay))
