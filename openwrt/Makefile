include $(TOPDIR)/rules.mk

PKG_NAME:=yingbay
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/yingbay
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=YingBay OpenWrt media center
  DEPENDS:=+node
endef

define Package/yingbay/description
  Cloud-drive direct play and ZTE IPTV with rtp2http for phones.
endef

define Build/Compile
endef

define Package/yingbay/install
	$(INSTALL_DIR) $(1)/opt/yingbay
	$(CP) ../server $(1)/opt/yingbay/
	$(CP) ../web/dist $(1)/opt/yingbay/web/dist
	$(CP) ../package.json $(1)/opt/yingbay/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/yingbay.init $(1)/etc/init.d/yingbay
endef

$(eval $(call BuildPackage,yingbay))
