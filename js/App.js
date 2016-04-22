var ipcRenderer = require('ipc-renderer'),
    Socket = require('./utils/Socket'),
    $ = require('jquery'),
    ServerConfigsCl = require('./collections/serverConfigsCl'),
    _app;

function App() {
  var self = this,
      serverConfig;

  // ensure we're a singleton
  if (_app) return _app;

  _app = this;
  this._awayCounts = null;
  this._notifUnread = 0;
  this._chatMessagesUnread = 0;

  this.serverConfigs = new ServerConfigsCl();
  this.serverConfigs.fetch();

  if (!(serverConfig = this.getServerConfig())) {
    this.setServerConfig(
      this.serverConfigs.create({ name: 'default' }).id
    );
  }

  console.log(localStorage._serverConfig);
  this.connectHeartbeatSocket();
}

App.prototype.getServerConfig = function() {
  var config = this.serverConfigs.get(localStorage.activeServer);

  if ((!localStorage.activeServer || !config) && this.serverConfigs.length) {
    localStorage.activeServer = this.serverConfigs.at(this.serverConfigs.length - 1).id;
    config = this.serverConfigs.get(localStorage.activeServer);
  }

  return config;  
};

App.prototype.setServerConfig = function(id) {
  if (!this.serverConfigs.get(id)) {
    throw new Error(`Unable to set the server config. It must be an id of one of the available
        server configs stored via the ServerConfigs collection.`)
  }

  localStorage.activeServer = id;
};

App.prototype.connectHeartbeatSocket = function() {
  var config;

  if (!(config = this.getServerConfig())) {
    throw new Error(`No server config is set. Please set one via setServerConfig().`);
  }

  if (this._heartbeatSocket) {
    this._heartbeatSocket.connect(config.getHeartbeatSocketUrl());
  } else {
    this._heartbeatSocket = new Socket(config.getHeartbeatSocketUrl());
  }
};

App.prototype.getHeartbeatSocket = function() {
  return this._heartbeatSocket;
};

App.prototype.login = function() {
  var config;

  if (!(config = this.getServerConfig())) {
    throw new Error(`No server config is set. Please set one via setServerConfig().`);
  }

  return $.ajax({
    url: config + '/login',
    method: 'POST',
    data: {
      username: config.get('username'),
      password: config.get('password')
    },
    timeout: 3000
  });  
};

App.prototype.getGuid = function(handle, resolver) {
  var url = resolver || 'https://resolver.onename.com/v2/users/',
      deferred = $.Deferred();

  if (!handle) {
    throw new Error('Please provide a handle.');
  }

  url = url.charAt(url.length - 1) !== '/' ? url + '/' : url;
  url += handle;

  $.get(url).done(function(data){
    if (data && data[handle] && data[handle].profile && data[handle].profile.account){
      var account = data[handle].profile.account.filter(function (accountObject) {
        return accountObject.service == 'openbazaar';
      });

      deferred.resolve(account[0].identifier);
    } else {
      deferred.reject();
    }
  }).fail(function(jqXHR, status, errorThrown){
    deferred.reject();
  });

  return deferred.promise();
};

App.prototype.playNotificationSound = function() {
  if (!this._notificationSound) {
    this._notificationSound = document.createElement('audio');
    this._notificationSound.setAttribute('src', './audio/notification.mp3');
  }

  this._notificationSound.play();
};

App.prototype.showOverlay = function() {
  this._$overlay = this._$overlay || $('#overlay');
  this._$overlay.removeClass('hide');
};

App.prototype.hideOverlay = function() {
  this._$overlay = this._$overlay || $('#overlay');
  this._$overlay.addClass('hide');
};

App.prototype.setUnreadCounts = function(notif, chat) {
  this._notifUnread = typeof notif === 'number' ? notif : this._notifUnread;
  this._chatMessagesUnread = typeof chat === 'number' ? chat : this._chatMessagesUnread;

  this._awayCounts = this._notifUnread + this._chatMessagesUnread;
  ipcRenderer.send('set-badge', this._awayCounts || '');
};

App.prototype.setUnreadNotifCount = function(count) {
  if (typeof count !== 'undefined' && count !== null) {
    this.setUnreadCounts(parseInt(count));
  }
};

App.prototype.setUnreadChatMessageCount = function(count) {
  if (typeof count !== 'undefined' && count !== null) {
    this.setUnreadCounts(null, parseInt(count));
  }
};

App.getApp = function() {
  if (!_app) {
    throw new Error('The app instance was never instantiated and is therefore not available.');
  }

  return _app;
};

module.exports = App;