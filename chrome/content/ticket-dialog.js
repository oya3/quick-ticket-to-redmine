function TicketDialog() {
	this.initialize.apply(this, arguments);
}

TicketDialog.prototype = {

redmineurl: "",
accesskey: "",
listing_project_path: "projects.xml",
listing_issue_path: "issues.xml",
authmethod: 1,
dialogurl:"chrome://quick-ticket-to-redmine/content/ticket-dialog.xul",

initialize: function() {
},

show: function(args) {
	window.openDialog(this.dialogurl, "_blank", "chrome,titlebar,resizable", args);
},

onLoad: function() {
	
	try {
		
		//引数からメール情報を取得する
		var nsIMsgDBHdr = window.arguments[0];

		//チケットオブジェクトを作成する。
		var ticket = new Ticket(nsIMsgDBHdr);


		//題名を設定する。
		var title_box = document.getElementById("title-box");
		title_box.value = ticket.title;

		//説明を設定する。
		var description_box = document.getElementById("description-box");
		description_box.value = ticket.description;

		//設定値を取得
		this.redmineurl = nsPreferences.copyUnicharPref("extensions.quick-ticket-to-redmine.redmineurlpref");
		this.accesskey = nsPreferences.copyUnicharPref("extensions.quick-ticket-to-redmine.redmineacceskeypref");
		this.authmethod = nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod");

		if(!this.redmineurl || this.redmineurl == 0 ){
			document.getElementById("notificationbox").appendNotification(
				"RedmineのURLが設定されていません。アドオンの設定よりRedmineのURLを設定してください。",
				"urlPrefError",
				null,
				"PRIORITY_WARNING_HIGH",
				null);
			return;
		}

		//変数にセットする。（念のため、trimを行う)
		this.redmineurl = this.redmineurl.replace(/(^\s+)|(\s+$)/g, "");

		//最後の文字がスラッシュでなければ、スラッシュを補完する。
		if(this.redmineurl.slice(-1) != "/") {
			this.redmineurl = this.redmineurl + "/";
		}

		//document.getElementById("ticket-dialog").centerWindowOnScreen();

		//プロジェクト一覧を呼び出す
		this.getProjectList();

		//トラッカーと担当の一覧を取得はプロジェクト選択した後しか選ばせない。
		// プロジェクトが決定したらばトラッカーとユーザー一覧を取得する。
		//this.getTrackerAndAssignedList();
		//this.getUsersByProject();
		//this.getTrackersByProject();

	}catch(ex){
		document.getElementById("notificationbox").appendNotification(
			"エラーが発生しました。" + ex,
			"showTicketdialogError",
			null,
			"PRIORITY_CRITICAL_HIGH",
			null);
	}
},

getProjectList: function() {

	var self = this;

	var url = this.redmineurl + this.listing_project_path;

	var request = Components.
		classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
			createInstance();

	// オブジェクトに nsIDOMEventTarget インタフェースを照会し、それにイベントハンドラをセット
	//request.QueryInterface(Components.interfaces.nsIDOMEventTarget);
	//request.addEventListener("progress", function(evt) {}, false);
	//request.addEventListener("load", function(evt) {}, false);
	//request.addEventListener("error", function(evt) {}, false);

	// nsIXMLHttpRequest を照会し、開き、リクエストを送信
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);

	//認証情報の設定
	if(nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod") == 0 ) {
		url = url + "?key=" + this.accesskey;
	}

/*
<?xml version="1.0" encoding="UTF-8"?>
<projects type="array" limit="25" offset="0" total_count="2">

 <project>
  <id>4</id>
  <name>PASMO開発</name>
  <identifier>ictmt</identifier>
  <description>PASMO開発作業、 PASMOメーカ間突合、品質改善の試験観点追加作業用のプロジェクトです </description>
  <created_on>2012-10-25T04:38:23Z</created_on>
  <updated_on>2012-10-25T04:38:23Z</updated_on>
 </project>
 
 <project>
  <id>2</id>
  <name>Sandproject</name>
  <identifier>sandbox</identifier>
  <description>色々とお試し用のプロジェクト </description>
  <created_on>2012-10-18T03:51:11Z</created_on>
  <updated_on>2012-10-18T03:51:11Z</updated_on>
 </project>
 
</projects>
*/
	request.open("GET", url, true);
	request.onreadystatechange = function (aEvt) {
		if (request.readyState == 4) {
			if(request.status == 200) {
				var projectsXML = request.responseXML;
				var projects = projectsXML.getElementsByTagName("project");

				var projectArray = [];

				for (var i=0; i<projects.length; i++){
					var hash = {};
					hash.id = projects[i].getElementsByTagName("id")[0].firstChild.nodeValue;
					hash.name = projects[i].getElementsByTagName("name")[0].firstChild.nodeValue;
					projectArray[i] = hash;
				}

				//メニューリストに取得したプロジェクトを追加する。
				var projectlist = document.getElementById("project-list");


				for (var i=0; i<projectArray.length; i++){
					projectlist.insertItemAt(i, projectArray[i].name, projectArray[i].id);

					//以前選択したプロジェクトをデフォルトで選択させるようにする。
					if(projectArray[i].id == self.loadRecentProjectId()) {
						projectlist.selectedIndex = i;
					}
				}

				if(projectlist.selectedIndex == -1) {
					projectlist.selectedIndex = 0;
				}

				document.getElementById("project-loading").style.display = "none";

			} else {
				document.getElementById("notificationbox").appendNotification(
					"Redmineに接続できません。設定を確認して下さい。url=" + self.redmineurl + " status=" + request.status,
					"getProjectList",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
			}
		}
	};
	request.send(null);
},

// プロジェクト選択時実行
// トラッカー、バージョン一覧、ユーザー一覧
// 取得方法は下記参照
// http://forza.cocolog-nifty.com/blog/2013/06/redminerest-api.html

// プロジェクト選択時ユーザ一覧を取得
// ・プロジェクトID＝2のメンバーを一覧表示
// http://localhost:3000/projects/2/memberships.xml?key=XXXX
/*
<?xml version="1.0" encoding="UTF-8"?>
<memberships type="array" limit="25" offset="0" total_count="9">

 <membership>
  <id>2</id>
  <project name="Sandproject" id="2"/>
  <user name="00 松本大郎" id="4"/>
  <roles type="array">
   <role name="管理者" id="3"/>
   <role name="開発者" id="4"/>
   <role name="報告者" id="5"/>
  </roles>
 </membership>
 
 <membership>
  <id>11</id>
  <project name="Sandproject" id="2"/>
  <user name="08 北村貴子" id="6"/>
  <roles type="array">
  <role name="開発者" id="4"/>
  </roles>
 </membership>
 
</memberships>

http://172.17.10.4/redmine/projects.xml
http://172.17.10.4/redmine/projects/1/memberships.xml
http://172.17.10.4/redmine/trackers.xml
http://172.17.10.4/redmine/projects/1.xml?include=trackers
*/
getUsersByProject: function() {

	var self = this;

	//if( assignedToList.childNodes.length > 0 ){
	document.getElementById("assigned-to-list").removeAllItems(); // 前回要素削除
	//}
	
//	if( null == document.getElementById("project-list").selectedItem.value ){
//		return;
//	}
	var project_id = document.getElementById("project-list").selectedItem.value; // 選択しているproject_idを取得

	var url = this.redmineurl + "projects/" + project_id + "/memberships.xml?limit=100";

	var request = Components.
		classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
			createInstance();

	// nsIXMLHttpRequest を照会し、開き、リクエストを送信
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);


	//認証情報の設定
	if(nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod") == 0 ) {
		url = url + "&key=" + this.accesskey;
	}
	/*
	document.getElementById("notificationbox").appendNotification(
		"dbg getUsersByProject url=" + url,
		"getUsersByProject",
		null,
		"PRIORITY_CRITICAL_HIGH",
		null);
	 */

	request.open("GET", url, true);
	request.onreadystatechange = function (aEvt) {
		if (request.readyState == 4) {
			if(request.status == 200) {
				var xml = request.responseXML;
				// ユーザー一覧を取得
				var memberships = xml.getElementsByTagName("membership");
				var userToArray = [];
				for (var i=0; i<memberships.length; i++){
					var hash = {};
					var tagName = 'user';
					if( null != memberships[i].getElementsByTagName('group')[0] ){ // groupの場合
						tagName = 'group';
					}
					hash.id   = memberships[i].getElementsByTagName(tagName)[0].getAttribute("id");
					hash.name = memberships[i].getElementsByTagName(tagName)[0].getAttribute("name");
					userToArray[i] = hash;
					/*
					document.getElementById("notificationbox").appendNotification(
						"dbg message memberships.length=[" + memberships.length + "]" + "hash.id=[" + hash.id + "]"+ "hash.name=[" + hash.name + "]" + i,
						"getUsersByProject",
						null,
						"PRIORITY_CRITICAL_HIGH",
						null);
					*/
				}
				/*
				document.getElementById("notificationbox").appendNotification(
					"userToArray.length=[" + userToArray.length + "]",
					"getUsersByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				*/
				//メニューリストに取得したトラッカーを追加する。
				var assignedToList = document.getElementById("assigned-to-list");
				assignedToList.selectedIndex = 0;
				
				var tmp = [];

				
				for (var i=0; i<userToArray.length; i++){
					if(!arrayContains(tmp, userToArray[i].id)){
						assignedToList.insertItemAt(i, userToArray[i].name, userToArray[i].id);
						tmp.push(userToArray[i].id);
//						//以前選択したプロジェクトをデフォルトで選択させるようにする。
//						if(userToArray[i].id == self.loadRecentAssignedToId()) {
//							assignedToList.selectedIndex = i;
//						}
					}
				}
				document.getElementById("assigned-to-loading").style.display = "none";
			}
		}
	};
	request.send(null);
},

// プロジェクト選択時トラッカー一覧を取得
// http://172.17.10.4/redmine/projects/1.xml?include=trackers
/*
<project>
 <id>2</id>
 <name>Sandproject</name>
 <identifier>sandbox</identifier>
 <description>色々とお試し用のプロジェクト </description>
 <homepage/>
 <created_on>2012-10-18T03:51:11Z</created_on>
 <updated_on>2012-10-18T03:51:11Z</updated_on>
 <trackers type="array">
  <tracker name="課題" id="5"/>
  <tracker name="サポート" id="3"/>
  <tracker name="バグ" id="1"/>
  <tracker name="イベント" id="4"/>
  <tracker name="機能" id="2"/>
  <tracker name="バグ６件１葉" id="10"/>
  <tracker name="バグ１件１葉" id="11"/>
 </trackers>
</project>
*/
getTrackersByProject: function() {

	var self = this;

	//if( trackerToList.childNodes.length > 0 ){
	document.getElementById("tracker-list").removeAllItems(); // 前回要素削除
	//}
	
//	if( null == document.getElementById("project-list").selectedItem.value ){
//		return;
//	}
	var project_id = document.getElementById("project-list").selectedItem.value; // 選択しているproject_idを取得

	var url = this.redmineurl + "projects/" + project_id + ".xml?include=trackers";

	var request = Components.
		classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
			createInstance();

	// nsIXMLHttpRequest を照会し、開き、リクエストを送信
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);

	//認証情報の設定
	if(nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod") == 0 ) {
		url = url + "&key=" + this.accesskey;
	}
	/*
	document.getElementById("notificationbox").appendNotification(
		"dbg message url=" + url,
		"getTrackersByProject",
		null,
		"PRIORITY_CRITICAL_HIGH",
		null);
	*/
	request.open("GET", url, true);
	request.onreadystatechange = function (aEvt) {
		if (request.readyState == 4) {
			if(request.status == 200) {
				var xml = request.responseXML;
				var trackers = xml.getElementsByTagName("tracker");
				var trackerToArray = [];

				for (var i=0; i<trackers.length; i++){
					var hash = {};
					hash.id = trackers[i].getAttribute("id");
					hash.name = trackers[i].getAttribute("name");
					trackerToArray[i] = hash;
					/*
					document.getElementById("notificationbox").appendNotification(
						"dbg message memberships.length=[" + trackers.length + "]" + "hash.id=[" + hash.id + "]"+ "hash.name=[" + hash.name + "]" + i,
						"getTrackersByProject",
						null,
						"PRIORITY_CRITICAL_HIGH",
						null);
					 */
				}
				/*
				document.getElementById("notificationbox").appendNotification(
					"for end",
					"getUsersByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				 */
				
				//メニューリストに取得したトラッカーを追加する。
				var trackerToList = document.getElementById("tracker-list");
	
				var tmp = [];
				for (var i=0; i<trackerToArray.length; i++){
					if(!arrayContains(tmp, trackerToArray[i].id)){
						trackerToList.insertItemAt(i, trackerToArray[i].name, trackerToArray[i].id);
						tmp.push(trackerToArray[i].id);
//						//以前選択したプロジェクトをデフォルトで選択させるようにする。
//						if(userToArray[i].id == self.loadRecentAssignedToId()) {
//							trackerToList.selectedIndex = i;
//						}
					}
				}
				document.getElementById("tracker-loading").style.display = "none";
			}
		}
	};
	request.send(null);
},

// プロジェクト選択時バージョン取得
/*
<?xml version="1.0" encoding="UTF-8"?>
<versions type="array" total_count="26">
 <version>
  <id>10</id>
  <project name="PASMO　13年度施策" id="5"/>
  <name>１３年度施策－フェーズ１</name>
  <description>関東１３年度施策のＰＡＳＭＯ施策、共通施策の対応したバージョン</description>
  <status>closed</status>
  <due_date>2013-05-31</due_date>
  <sharing>none</sharing>
  <created_on>2013-03-25T10:53:12Z</created_on>
  <updated_on>2013-10-28T07:51:21Z</updated_on>
 </version>
</versions>
*/
getVersionsByProject: function() {

	var self = this;

	//if( trackerToList.childNodes.length > 0 ){
	document.getElementById("version-list").removeAllItems(); // 前回要素削除
	//}
	
	var project_id = document.getElementById("project-list").selectedItem.value; // 選択しているproject_idを取得
	
	// http://172.17.10.4/redmine/projects/5/versions.xml?limit-100&key=afd3b83167f6e4196a1db76363c6d124d5d5e1c4
	var url = this.redmineurl + "projects/" + project_id + "/versions.xml?limit=100";

	var request = Components.
		classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
			createInstance();

	// nsIXMLHttpRequest を照会し、開き、リクエストを送信
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);

	//認証情報の設定
	if(nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod") == 0 ) {
		url = url + "&key=" + this.accesskey;
	}
	/*
	document.getElementById("notificationbox").appendNotification(
		"dbg message url=" + url,
		"getTrackersByProject",
		null,
		"PRIORITY_CRITICAL_HIGH",
		null);
	*/
	request.open("GET", url, true);
	request.onreadystatechange = function (aEvt) {
		if (request.readyState == 4) {
			if(request.status == 200) {
				/*
				document.getElementById("notificationbox").appendNotification(
					"getVersionsByProject url=" + url,
					"getVersionsByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				*/
				var xml = request.responseXML;
				var versions = xml.getElementsByTagName("version");
				var versionToArray = [];
				//var arrayIndex = 0;
				for (var i=0; i<versions.length; i++){
					/*
					document.getElementById("notificationbox").appendNotification(
						"status=[" + versions[i].getElementsByTagName("status")[0].firstChild.nodeValue + "]" + i,
						"getVersionsByProject",
						null,
						"PRIORITY_CRITICAL_HIGH",
						null);
					*/
					if( versions[i].getElementsByTagName("status")[0].firstChild.nodeValue == "closed"){
						continue;
					}
					
					var hash = {};
					hash.id = versions[i].getElementsByTagName("id")[0].firstChild.nodeValue;
					hash.name = versions[i].getElementsByTagName("name")[0].firstChild.nodeValue;
					//versionToArray[arrayIndex] = hash;
					versionToArray.push(hash);
					//arrayIndex++;
					/*
					document.getElementById("notificationbox").appendNotification(
						"getVersionsByProject versions.length=[" + versions.length + "]" + "hash.id=[" + hash.id + "]"+ "hash.name=[" + hash.name + "]" + i,
						"getVersionsByProject",
						null,
						"PRIORITY_CRITICAL_HIGH",
						null);
					*/
				}
				/*
				document.getElementById("notificationbox").appendNotification(
					"for end",
					"getVersionsByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				 */
				
				//メニューリストに取得したトラッカーを追加する。
				var versionToList = document.getElementById("version-list");
				
				var tmp = [];
				/*
				document.getElementById("notificationbox").appendNotification(
					"0versionToArray.length=[" + versionToArray.length + "]" + "id=[" + versionToArray[0].id + "]",
					"getVersionsByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				 */
				for (var i=0; i<versionToArray.length; i++){
					/*
					document.getElementById("notificationbox").appendNotification(
						"1versionToArray[i] id=[" + versionToArray[i].id + "]" + "name=[" + versionToArray[i].name + "]"+ i,
						"getVersionsByProject",
						null,
						"PRIORITY_CRITICAL_HIGH",
						null);
					 */
						
					if(!arrayContains(tmp, versionToArray[i].id)){
						/*
						document.getElementById("notificationbox").appendNotification(
							"2versionToArray[i] id=[" + versionToArray[i].id + "]" + "name=[" + versionToArray[i].name + "]"+ i,
							"getVersionsByProject",
							null,
							"PRIORITY_CRITICAL_HIGH",
							null);
						*/
						versionToList.insertItemAt(i, versionToArray[i].name, versionToArray[i].id);
						tmp.push(versionToArray[i].id);
//						//以前選択したプロジェクトをデフォルトで選択させるようにする。
//						if(userToArray[i].id == self.loadRecentAssignedToId()) {
//							versionToList.selectedIndex = i;
//						}
					}
				}
				/*
				document.getElementById("notificationbox").appendNotification(
					"2versionToArray.length=[" + versionToArray.length + "]",
					"getVersionsByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				*/
				document.getElementById("version-loading").style.display = "none";
				/*
				document.getElementById("notificationbox").appendNotification(
					"3versionToArray.length=[" + versionToArray.length + "]",
					"getVersionsByProject",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
				 */
			}
		}
	};
	request.send(null);
},



// トラッカー一覧と担当一覧を取得
getTrackerAndAssignedList: function() {

	var self = this;

	var url = this.redmineurl + this.listing_issue_path + "?assigned_to=me";

	//認証情報の設定
	if(nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod") == 0 ) {
		url = url + "&key=" + this.accesskey;
	}

	var request = Components.
		classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
			createInstance();

	// nsIXMLHttpRequest を照会し、開き、リクエストを送信
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);


	request.open("GET", url, true);
	request.onreadystatechange = function (aEvt) {
		if (request.readyState == 4) {
			if(request.status == 200) {
				var xml = request.responseXML;

				//トラッカーの一覧をメニューリストに格納
				var trackers = xml.getElementsByTagName("tracker");

				var trackerArray = [];

				for (var i=0; i<trackers.length; i++){
					var hash = {};
					hash.id = trackers[i].getAttribute("id");
					hash.name = trackers[i].getAttribute("name");
					trackerArray[i] = hash;
				}

				//メニューリストに取得したトラッカーを追加する。
				var trackerlist = document.getElementById("tracker-list");

				var tmp = [];
				for (var i=0; i<trackerArray.length; i++){
					if(!arrayContains(tmp, trackerArray[i].id)){
						trackerlist.insertItemAt(i, trackerArray[i].name, trackerArray[i].id);
						tmp.push(trackerArray[i].id);

						//以前選択したプロジェクトをデフォルトで選択させるようにする。
						if(trackerArray[i].id == self.loadRecentTrackerId()) {
							trackerlist.selectedIndex = i;
						}
					}
				}

				document.getElementById("tracker-loading").style.display = "none";

				//担当者を自分自身に設定
				var assigned_tos = xml.getElementsByTagName("assigned_to");

				var assignedToArray = [];

				for (var i=0; i<assigned_tos.length; i++){
					var hash = {};
					hash.id = assigned_tos[i].getAttribute("id");
					hash.name = assigned_tos[i].getAttribute("name");
					assignedToArray[i] = hash;
				}

				//メニューリストに取得したトラッカーを追加する。
				var assignedToList = document.getElementById("assigned-to-list");

				var tmp = [];
				for (var i=0; i<assignedToArray.length; i++){
					if(!arrayContains(tmp, assignedToArray[i].id)){
						assignedToList.insertItemAt(i, assignedToArray[i].name, assignedToArray[i].id);
						tmp.push(assignedToArray[i].id);

						//以前選択したプロジェクトをデフォルトで選択させるようにする。
						if(assignedToArray[i].id == self.loadRecentAssignedToId()) {
							assignedToList.selectedIndex = i;
						}
					}
				}

				document.getElementById("assigned-to-loading").style.display = "none";

			} else {
				document.getElementById("notificationbox").appendNotification(
					"Redmineに接続できません。設定を確認して下さい。url=" + self.redmineurl + " status=" + request.status,
					"getTrackerAndAssignedList",
					null,
					"PRIORITY_CRITICAL_HIGH",
					null);
			}
		}
	};
	request.send(null);
},


// redmine チケット登録(POST)
createIssue: function(ticket) {

	var self = this;

	//選択した値を保存する
	this.saveRecentProjectId(ticket.project_id);
	this.saveRecentTrackerId(ticket.tracker_id);
	this.saveRecentAssignedToId(ticket.assigned_to_id);

	var url = this.redmineurl + this.listing_issue_path;

	var request = Components.
		classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
			createInstance();

	// オブジェクトに nsIDOMEventTarget インタフェースを照会し、それにイベントハンドラをセット
	//request.QueryInterface(Components.interfaces.nsIDOMEventTarget);
	//request.addEventListener("progress", function(evt) {}, false);
	//request.addEventListener("load", function(evt) {}, false);
	//request.addEventListener("error", function(evt) {}, false);

	// nsIXMLHttpRequest を照会し、開き、リクエストを送信
	request.QueryInterface(Components.interfaces.nsIXMLHttpRequest);

	//認証情報の設定
	if(nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.authmethod") == 0 ) {
		url = url + "?key=" + this.accesskey;
	}

	request.open("POST", url, true);
	request.setRequestHeader("Content-Type", "application/xml; charset=utf-8");
	request.onreadystatechange = function (aEvt) {
		if (request.readyState == 1){
			//プログレスバーを表示
			self.showProgress();
		}

		if (request.readyState == 4) {
			//プログレスバーを非表示にする
			self.hideProgress();

			if(request.status == 201) {
				var responseXML = request.responseXML;
				var id = responseXML.getElementsByTagName("id")[0].firstChild.nodeValue;
				var created_pageurl = ticketDialog.redmineurl + "issues/" + id;

				ticketDoneDialog.show(created_pageurl);
				document.getElementById("ticket-dialog").cancelDialog();

			} else if(request.status == 422) {
				var responseXML = request.responseXML;
				var errors = responseXML.getElementsByTagName("error");
				var message = "";
				for(var i = 0; i<errors.length; i++){
					message = message + errors[i].firstChild.nodeValue + "\n";
				}
				ALERT(message, "チケットの登録に失敗しました");
			} else {
				ALERT("status: " + request.status, "チケットの登録に失敗しました");
			}
		}
	};
	/*
	document.getElementById("notificationbox").appendNotification(
		"ticket.version_id=[" +ticket.version_id + "]",
		"createIssue",
		null,
		"PRIORITY_CRITICAL_HIGH",
		null);
	*/
	request.send(ticket.serializeToString());
},

// 登録ボタン押下時実行
onAccept: function() {

	//チケットオブジェクトにデータを格納する。
	var ticket = new Ticket();

	try{

		ticket.title = document.getElementById("title-box").value;
		ticket.project_id = document.getElementById("project-list").selectedItem.value;
		if(document.getElementById("tracker-list").selectedItem){
			ticket.tracker_id = document.getElementById("tracker-list").selectedItem.value;
		}
		if(document.getElementById("assigned-to-list").selectedItem){
			ticket.assigned_to_id = document.getElementById("assigned-to-list").selectedItem.value;
		}
		ticket.description = document.getElementById("description-box").value;
		ticket.start_date = document.getElementById("start-date-box").value;
		if(document.getElementById("end-date-checkbox").checked){
			ticket.due_date = document.getElementById("end-date-box").value;
		}
		ticket.estimated_hours = document.getElementById("estimated-hours-box").value;
		ticket.parent_issue_id = document.getElementById("parent_issue_id-box").value;
		if(document.getElementById("version-list").selectedItem){
			ticket.version_id = document.getElementById("version-list").selectedItem.value;
		}

		this.createIssue(ticket);

	}catch(ex){
		document.getElementById("notificationbox").appendNotification(
			"エラーが発生しました。" + ex,
			"onAccept",
			null,
			"PRIORITY_CRITICAL_HIGH",
			null);
		return;
	}

	return false;
},

// キャンセルボタン押下時実行
onCancel: function() {
	return true;
},

showProgress: function() {
	document.getElementById("progressbar").style.visibility = "visible";
},

hideProgress: function() {
	document.getElementById("progressbar").style.visibility = "hidden";
},

saveRecentProjectId: function(id) {
	nsPreferences.setIntPref("extensions.quick-ticket-to-redmine.recentprojectid", id);
},

loadRecentProjectId: function() {
	return nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.recentprojectid");
},
saveRecentTrackerId: function(id) {
	nsPreferences.setIntPref("extensions.quick-ticket-to-redmine.recenttrackerid", id);
},

loadRecentTrackerId: function() {
	return nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.recenttrackerid");
},
saveRecentAssignedToId: function(id) {
	nsPreferences.setIntPref("extensions.quick-ticket-to-redmine.recentassignedtoid", id);
},

loadRecentAssignedToId: function() {
	return nsPreferences.getIntPref("extensions.quick-ticket-to-redmine.recentassignedtoid");
},

onCommandEndDate: function(event) {
	var target = event.target;
	if(target.checked){
		document.getElementById("endDateBroadcast").removeAttribute("disabled");
	}else{
		document.getElementById("endDateBroadcast").setAttribute("disabled", true);
	}
},

// 参考サイト
// http://kittttttan.web.fc2.com/xul/extension3b.html
onCommandReloadUsersAndTrackers: function(event) {
	var target = event.target;
	this.getUsersByProject();
	this.getTrackersByProject();
	this.getVersionsByProject();
},

showTicketDoneDialog: function(args) {
	window.openDialog(this.dialogurl, "_blank", "chrome,titlebar,resizable", args);
},
};

var ticketDialog = new TicketDialog();

