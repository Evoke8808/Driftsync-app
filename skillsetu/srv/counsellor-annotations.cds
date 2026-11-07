using CounsellorService as s from './counsellor-service';

// SAP Fiori Elements UI for the counsellor app: a List Report of cases and an Object Page per case.
annotate s.Cases with @(
  UI.HeaderInfo: {
    TypeName      : 'Case',
    TypeNamePlural: 'Cases',
    Title         : { Value: name },
    Description   : { Value: code }
  },
  UI.SelectionFields: [ status, targetRole, district ],
  UI.LineItem: [
    { Value: code,       Label: 'Case' },
    { Value: name,       Label: 'Name' },
    { Value: statusText, Label: 'Status', Criticality: statusCriticality },
    { Value: skillCount, Label: 'Skills' },
    { Value: targetRole, Label: 'Target job' },
    { Value: reviewedBy, Label: 'Reviewed by' },
    { Value: modifiedAt, Label: 'Last change' },
    { $Type: 'UI.DataFieldForAction', Action: 'CounsellorService.approve',        Label: 'Approve' },
    { $Type: 'UI.DataFieldForAction', Action: 'CounsellorService.requestChanges', Label: 'Request changes' }
  ],
  UI.PresentationVariant: {
    SortOrder     : [ { Property: modifiedAt, Descending: true } ],
    Visualizations: [ '@UI.LineItem' ]
  },
  UI.Identification: [
    { $Type: 'UI.DataFieldForAction', Action: 'CounsellorService.approve',              Label: 'Approve' },
    { $Type: 'UI.DataFieldForAction', Action: 'CounsellorService.requestChanges',       Label: 'Request changes' },
    { $Type: 'UI.DataFieldForAction', Action: 'CounsellorService.sendToSuccessFactors', Label: 'Send to SAP SuccessFactors' }
  ],
  UI.HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Status', Label: 'Review' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#SF',     Label: 'SAP SuccessFactors' }
  ],
  UI.FieldGroup #Status: { Data: [
    { Value: statusText, Label: 'Status', Criticality: statusCriticality },
    { Value: reviewedBy, Label: 'Reviewed by' },
    { Value: modifiedAt, Label: 'Last change' }
  ] },
  UI.FieldGroup #SF: { Data: [ { Value: sfText, Label: 'Application' } ] },
  UI.FieldGroup #Skills:   { Data: [ { Value: skillsText,   Label: 'Skills and the words that prove them' } ] },
  UI.FieldGroup #Plan:     { Data: [ { Value: targetRole, Label: 'Target job' }, { Value: planText, Label: 'Learning plan' } ] },
  UI.FieldGroup #Fairness: { Data: [ { Value: barriersText, Label: 'What a typical résumé filter would reject' } ] },
  UI.FieldGroup #Story:    { Data: [ { Value: story, Label: 'In their own words' } ] },
  UI.FieldGroup #Decision: { Data: [ { Value: counsellorNote, Label: 'Your note to the person' }, { Value: district, Label: 'District' }, { Value: externalRef, Label: 'Partner reference' } ] },
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'Skills',   Label: 'Skills',         Target: '@UI.FieldGroup#Skills' },
    { $Type: 'UI.ReferenceFacet', ID: 'Plan',     Label: 'Plan',           Target: '@UI.FieldGroup#Plan' },
    { $Type: 'UI.ReferenceFacet', ID: 'Fairness', Label: 'Fairness check', Target: '@UI.FieldGroup#Fairness' },
    { $Type: 'UI.ReferenceFacet', ID: 'Story',    Label: 'Story',          Target: '@UI.FieldGroup#Story' },
    { $Type: 'UI.ReferenceFacet', ID: 'Decision', Label: 'Decision',       Target: '@UI.FieldGroup#Decision' },
    { $Type: 'UI.ReferenceFacet', ID: 'Chat',     Label: 'Chat',           Target: 'messages/@UI.LineItem' },
    { $Type: 'UI.ReferenceFacet', ID: 'Trace',    Label: 'Agent trace',    Target: 'log/@UI.LineItem' }
  ]
);

annotate s.Cases with {
  ID          @UI.Hidden;
  status      @title: 'Status code';
  targetRole  @title: 'Target job';
  district    @title: 'District';
  skillsText  @UI.MultiLineText;
  planText    @UI.MultiLineText;
  barriersText @UI.MultiLineText;
  story       @UI.MultiLineText;
};

// Computed fields can't be filtered or sorted.
annotate s.Cases with @Capabilities: {
  FilterRestrictions: { NonFilterableProperties: [ code, statusText, statusCriticality, skillCount, skillsText, planText, barriersText, sfText ] },
  SortRestrictions  : { NonSortableProperties:   [ code, statusText, statusCriticality, skillCount, skillsText, planText, barriersText, sfText ] }
};

annotate s.Messages with @(
  UI.LineItem: [
    { Value: seq,   Label: '#' },
    { Value: role,  Label: 'From' },
    { Value: agent, Label: 'Agent' },
    { Value: text,  Label: 'Message' }
  ],
  UI.PresentationVariant: { SortOrder: [ { Property: seq } ], Visualizations: [ '@UI.LineItem' ] }
);

annotate s.Trail with @(
  UI.LineItem: [
    { Value: seq,      Label: '#' },
    { Value: agent,    Label: 'Agent' },
    { Value: routedBy, Label: 'Routed by' },
    { Value: reason,   Label: 'Why' },
    { Value: provider, Label: 'AI or code' },
    { Value: ms,       Label: 'ms' }
  ],
  UI.PresentationVariant: { SortOrder: [ { Property: seq } ], Visualizations: [ '@UI.LineItem' ] }
);
