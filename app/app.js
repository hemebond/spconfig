(function() {
	"use strict";

	angular
		.module('SPConfig', ['monospaced.elastic'])
		.controller('ConfigController', function($scope, $window, $compile) {

			var createSecurityRolesRule = function() {
				var CDATA = '## Add entitlements\n#set($entitlements = "")\n#macro(addEntitlementIfDefined $entitlement $roleValue)\n\t#if(${currentLoginContext.hasEntitlement($entitlement)})\n\t\t#if($entitlements != "")\n\t\t\t#set($entitlements = $entitlements + ",")\n\t\t#end\n\t\t#set($entitlements = $entitlements + $roleValue)\n\t#end\n#end\n';

				for (var i = 0; i < $scope.entitlements.length; i++) {
					var e = $scope.entitlements[i];

					if (e !== '') {
						CDATA += '#addEntitlementIfDefined("' + e + '", "' + e + '")\n';
					}
					else {
						continue;
					}
				}

				return CDATA + '$entitlements';
			};
			$scope.securityRolesAttributeMap = {
				tname: 'ESAA2_SECURITYROLES',
				cdata: createSecurityRolesRule,
				help: 'User’s entitlements as a comma separated String.'
			};

			// Which application is this SP Config for?
			$scope.applicationName = "Test Application";

			// Attribute maps
			$scope.attributeMaps = [
				{
					tname: 'ESAA2_UUID',
					rule: '$!{currentUser.uniqueId}',
					help: 'Universally unique identifier (CDI or PDI?).'
				},
				{
					tname: 'ESAA2_MIDDLENAME',
					cdata: '## Use CDI then PDI Middlenames\n#set ($middleNames = $!{currentLoginContext.getAttributeValue("middleNames")})\n#if ("$middleNames" == "" || ! $middleNames)\n#set ($middleNames = $!{currentUser.getAttributeValue("middleNames")})\n#end\n$!{middleNames}',
					help: 'Middle name from PDI or CDI'
				},
				{
					tname: 'ESAA2_CONTACTEMAIL',
					cdata: '## Use CDI then PDI Email\n#set ($email = $!{currentLoginContext.getAttributeValue("email")})\n#if ("$email" == "" || ! $email)\n\t#set ($email = $!{currentUser.getAttributeValue("email")})\n#end\n$!{email}',
					help: 'Release user’s Contextual email address (CDI) if present otherwise his personal email address (PDI).'
				},
				{
					tname: 'ESAA2_PREFERREDNAME',
					cdata: '## Use CDI then PDI PreferredName\n#set ($preferredName = $!{currentLoginContext.getAttributeValue("preferredName")})\n#if ("$preferredName" == "" || ! $preferredName)\n\t#set ($preferredName = $!{currentUser.getAttributeValue("preferredName")})\n#end\n$!{preferredName}',
					help: 'Release user’s Contextual preferred name (CDI) if present otherwise his personal (PDI) one.'
				},
				{
					tname: 'ESAA2_LOGGEDINCONTEXTNAME',
					rule: '$!{currentUser.organizationName}',
					help: 'The name of the context, e.g., My School.'
				},
				{
					tname: 'ESAA2_LOGGEDINCONTEXTID',
					rule: '$!{currentOrganization.getAttributeValue("partyID")}',
					help: 'The ID of the context, e.g., 12345.'
				},
				{
					tname: 'ESAA2_TITLE',
					cdata: '## Use CDI then PDI Title\n#set ($title = $!{currentLoginContext.getAttributeValue("title")})\n#if ("$title" == "" || ! $title)\n#set ($title = $!{currentUser.getAttributeValue("title")})\n#end\n$!{title}',
					help: 'User’s PDI attribute value.'
				}
			];

			// The entitlements and roles for the SECURITY_ROLES attribute map
			$scope.entitlements = ['APP_ENTITLEMENT', ''];

			$scope.addEntitlementFormFields = function() {
				$scope.entitlements.push('');
			};

			// Beautify the XML when displaying it?
			$scope.beautify = true;

			var addAttributeMap = function(xml, o) {
				var attributeMapClass = xml.getElementsByTagName('idaptiveAttributeMapClass')[0];
				var attributeTargets = xml.getElementsByTagName('idaptiveAttributeMapNVTargetName');
				var referenceNumber = attributeTargets.length;

				if (o.name) {
					var eName = xml.createElement('idaptiveAttributeMapNVName');
					var eNameText = xml.createTextNode("{" + referenceNumber + "}" + o['name']);
					eName.appendChild(eNameText);
				}

				var eTargetName = xml.createElement('idaptiveAttributeMapNVTargetName');
				var eTargetNameText = xml.createTextNode("{" + referenceNumber + "}" + o['tname']);
				eTargetName.appendChild(eTargetNameText);

				var eRule = xml.createElement('idaptiveAttributeMapNVRule');
				var eRuleText = xml.createTextNode("{" + referenceNumber + "}");

				if (o['cdata'] !== undefined) {
					var eRuleCDATA = null;

					// We can use a function to create the
					// rule data/string
					if (typeof o['cdata'] === 'function') {
						eRuleCDATA = xml.createCDATASection(o['cdata']());
					}
					else {
						eRuleCDATA = xml.createCDATASection(o['cdata']);
					}

					eRule.appendChild(eRuleText);
					eRule.appendChild(eRuleCDATA);
				}
				else {
					eRuleText.data += o['rule'];
					eRule.appendChild(eRuleText);
				}

				if (o.name) {
					attributeMapClass.appendChild(eName);
				}

				attributeMapClass.appendChild(eRule);
				attributeMapClass.appendChild(eTargetName);
			};

			var createConfig = function(conf) {
				var parser = new DOMParser();
				var template = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><idaptiveServiceProviderClass><idaptiveServiceProviderName></idaptiveServiceProviderName><attributemaps><idaptiveAttributeMapClass><idaptiveAttributeMapName>all_orgs_except_public_and_central_admin</idaptiveAttributeMapName><idaptiveOrganizationDN>idaptiveOrganizationDescription=~Central Admin*,objectClass=idaptiveOrganizationClass$,cn=communities,ou=idaptive-config</idaptiveOrganizationDN><idaptiveCommunityDN>idaptiveCommunityDescription=~Public$,objectClass=idaptiveCommunityClass$,cn=communities,ou=idaptive-config</idaptiveCommunityDN></idaptiveAttributeMapClass></attributemaps></idaptiveServiceProviderClass>";
				var xml = parser.parseFromString(template, "text/xml");

				// Update the idaptiveServiceProviderName element
				// with the application name
				var serviceProviderNameText = xml.createTextNode(conf['applicationName']);
				xml.getElementsByTagName('idaptiveServiceProviderName')[0].appendChild(serviceProviderNameText);

				var i = 0;
				// Add the attribute maps
				for (i = 0; i < conf.attributeMaps.length; i++) {
					addAttributeMap(xml, conf.attributeMaps[i]);
				}

				// Create an attribute map for the security roles, aka, entitlements
				if ($scope.securityRolesAttributeMap.enabled === true) {
					addAttributeMap(xml, $scope.securityRolesAttributeMap);

					// Add attribute maps for filtering CDIs on entitlements
					// i.e., only show CDIs that has one of the entitlements
					for (i = 0; i < $scope.entitlements.length; i++) {
						var e = $scope.entitlements[i];

						if (e !== '') {
							addAttributeMap(xml, {
								name: "__INTERNAL_USE_ONLY__",
								tname: "__cdi_enabling_entitlement_id__",
								rule: e
							});
						}
					}
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
