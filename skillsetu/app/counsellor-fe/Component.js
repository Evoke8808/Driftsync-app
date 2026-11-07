// SAP Fiori Elements app (List Report + Object Page) for counsellors. It uses the SkillSetu counsellor sign-in:
// the session token from the main app is sent with every OData call; without one, you go to the sign-in page.
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
  "use strict";
  return AppComponent.extend("skillsetu.counsellor.Component", {
    metadata: { manifest: "json" },
    init: function () {
      var a = null;
      try { a = JSON.parse(window.localStorage.getItem("ss-auth") || "null"); } catch (e) { /* no session */ }
      if (!a || a.role !== "counsellor" || !a.token) {
        window.location.href = "/#/counsellor-login";
        return;
      }
      this.getModel().changeHttpHeaders({ "X-SkillSetu-Token": a.token });
      AppComponent.prototype.init.apply(this, arguments);
    }
  });
});
