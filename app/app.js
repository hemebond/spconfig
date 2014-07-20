(function() {
	"use strict";

	angular
		.module('SPConfig', ['monospaced.elastic'])
		.controller('ConfigController', function($scope, $window, $compile) {
			var createSecurityRolesRule = function() {
				var CDATA = '## Add entitlements\n#set($entitlements = "")\n#macro(addEntitlementIfDefined $entitlement $roleValue)\n\t#if(${currentLoginContext.hasEntitlement($entitlement)})\n\t\t#if($entitlements != "")\n\t\t\t#set($entitlements = $entitlements + ",")\n\t\t#end\n\t\t#set($entitlements = $entitlements + $roleValue)\n\t#end\n#end\n';

				for (var i = 0; i < $scope.securityRoles.length; i++) {
					var role = $scope.securityRoles[i].name;
					var entitlement = $scope.securityRoles[i].entitlement;

					if (role !== "" && entitlement !== "") {
						CDATA += '#addEntitlementIfDefined("' + entitlement + '", "' + role + '")\n';
					}
					else {
						continue;
					}
				}

				CDATA += '$entitlements';

				return CDATA;
			};

			// Which application is this SP Config for?
			$scope.applicationName = "Test Application";

			// Attribute maps
			$scope.attributeMaps = [
				{
					name: 'ESAA2_UUID',
					rule: '$!{currentUser.uniqueId}',
					help: 'The login ID or username.'
				},
				{
					name: 'ESAA2_CONTACTEMAIL',
					cdata: true,
					rule: '## Use CDI then PDI Email\n#set ($email = $!{currentLoginContext.getAttributeValue("email")})\n#if ("$email" == "" || ! $email)\n\t#set ($email = $!{currentUser.getAttributeValue("email")})\n#end\n$!{email}',
					help: 'Email address for the CDI or the PDI.'
				},
				{
					name: 'ESAA2_PREFERREDNAME',
					cdata: true,
					rule: '## Use CDI then PDI PreferredName\n#set ($preferredName = $!{currentLoginContext.getAttributeValue("preferredName")})\n#if ("$preferredName" == "" || ! $preferredName)\n\t#set ($preferredName = $!{currentUser.getAttributeValue("preferredName")})\n#end\n$!{preferredName}',
					help: 'Preferred name for the CDI or PDI.'
				},
				{
					name: 'ESAA2_LOGGEDINCONTEXTNAME',
					rule: '$!{currentUser.organizationName}',
					help: 'The name of the context, e.g., My School.'
				},
				{
					name: 'ESAA2_LOGGEDINCONTEXTID',
					rule: '$!{currentOrganization.getAttributeValue("partyID")}',
					help: 'The ID of the context, e.g., 12345.'
				},
				{
					name: 'ESAA2_TITLE',
					rule: '$!{currentUser.getAttributeValue("title")}',
					help: 'Mr, Ms, etc.'
				},
				{
					name: 'ESAA2_SECURITYROLES',
					cdata: true,
					rule: createSecurityRolesRule,
					help: 'A list of entitlements to check for.'
				}
			];

			// The entitlements and roles for the SECURITY_ROLES attribute map
			$scope.securityRoles = [
				{
					name: 'APP_ROLE',
					entitlement: 'APP_ENTITLEMENT'
				},
				{
					name: '',
					entitlement: ''
				}
			];

			// Beautify the XML when displaying it?
			$scope.beautify = true;

			$scope.addEntitlementFormFields = function() {
				$scope.securityRoles.push({name: '', entitlement: ''});
			};

			var addAttributeMap = function(xml, o) {
				var attributeMapClass = xml.getElementsByTagName('idaptiveAttributeMapClass')[0];
				var attributeTargets = xml.getElementsByTagName('idaptiveAttributeMapNVTargetName');
				var referenceNumber = attributeTargets.length;

				var eName = xml.createElement('idaptiveAttributeMapNVTargetName');
				var eNameText = xml.createTextNode("{" + referenceNumber + "}" + o['name']);
				eName.appendChild(eNameText);

				var eRule = xml.createElement('idaptiveAttributeMapNVRule');

				if (o['cdata'] !== undefined && o['cdata'] === true) {
					var eRuleText = xml.createTextNode("{" + referenceNumber + "}");

					if (typeof o['rule'] === 'function') {
						var fn = o['rule'];
						var eRuleCDATA = xml.createCDATASection(fn());
					}
					else {
						var eRuleCDATA = xml.createCDATASection(o['rule']);
					}

					eRule.appendChild(eRuleText);
					eRule.appendChild(eRuleCDATA);
				}
				else {
					var eRuleText = xml.createTextNode("{" + referenceNumber + "}" + o['rule']);
					eRule.appendChild(eRuleText);
				}

				attributeMapClass.appendChild(eRule);
				attributeMapClass.appendChild(eName);
			};

			var createConfig = function(conf) {
				var parser = new DOMParser();
				var template = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><idaptiveServiceProviderClass><idaptiveServiceProviderName></idaptiveServiceProviderName><attributemaps><idaptiveAttributeMapClass><idaptiveAttributeMapName>all_orgs_except_public</idaptiveAttributeMapName><idaptiveOrganizationDN>cn=*,objectClass=idaptiveOrganizationClass$,cn=communities,ou=idaptive-config</idaptiveOrganizationDN><idaptiveCommunityDN>idaptiveCommunityDescription=~Public$,objectClass=idaptiveCommunityClass$,cn=communities,ou=idaptive-config</idaptiveCommunityDN></idaptiveAttributeMapClass></attributemaps></idaptiveServiceProviderClass>";
				var xml = parser.parseFromString(template, "text/xml");

				// Update the idaptiveServiceProviderName element
				var serviceProviderNameText = xml.createTextNode(conf['applicationName']);
				xml.getElementsByTagName('idaptiveServiceProviderName')[0].appendChild(serviceProviderNameText);

				for (var i = 0; i < conf.attributeMaps.length; i++) {
					addAttributeMap(xml, conf.attributeMaps[i]);
				}

				return xml;
			};

			$scope.updateXML = function() {
				var config = {
					applicationName: $scope.applicationName,
					attributeMaps: []
				};

				for (var i = 0; i < $scope.attributeMaps.length; i++) {
					var map = $scope.attributeMaps[i];

					if (map.enabled !== undefined && map.enabled === true) {
						config.attributeMaps.push(map);
					}
				}

				var xml = createConfig(config);

				var serializer = new XMLSerializer();
				xml = serializer.serializeToString(xml);

				if ($scope.beautify === true) {
					xml = vkbeautify.xml(xml, '\t');
				}

				$scope.xml = xml;
			};

			$scope.updateXML();
		})
		.directive('autoGrow', function() {
			return function(scope, element) {
				element.bind('change', function() {
					if (element.scrollHeight > element.clientHeight) {
						element.style.height = element.scrollHeight + "px";
					}
				});
			};
		});
})();
