const endpoint = action => ({pathname:'/api/studio',query:{action}});
const run = {id:'FZIT-20261117-TEST-abcd1234',revision:1,mode:'test',status:'queued',next_stage:1};
const target = 'https://www.linkedin.com/company/fazal-it/home/';
const hash = 'a'.repeat(64);
const review = {factual:'PASS',visual:'PASS',brand:'PASS',issues:[]};
const packet = {revision:1,caption:'Verified caption',alt:'Graphic alt text',target,payloadHash:hash,readiness:'AWAITING_OWNER_APPROVAL'};

function signIn() {
  cy.visit('/');
  cy.get('#token').type('cypress-fixture-owner-token',{log:false});
  cy.contains('button','Open studio').click();
}
it('denies unauthenticated requests on the real server', () => {
  cy.request({url:'/api/studio?action=list',failOnStatusCode:false}).its('status').should('eq',401);
  cy.request({url:'/api/studio?action=cron',failOnStatusCode:false}).its('status').should('eq',401);
});
it('creates a private test, visits all stages and approves the exact revision', () => {
  let state = {...run};
  let exists = false;
  cy.intercept(endpoint('list'),req => req.reply({runs:exists ? [state] : []}));
  cy.intercept(endpoint('create'),req => { exists = true; req.reply({id:run.id}); });
  cy.intercept(endpoint('get'),req => req.reply(state));
  cy.intercept(endpoint('step'),req => {
    const stage = state.next_stage;
    state = {...state,next_stage:stage+1,completed:Array.from({length:stage},(_,index) => index+1)};
    if (stage === 5) state = {...state,status:'review',review,packet};
    req.reply(state);
  });
  cy.intercept(endpoint('image'),{statusCode:200,headers:{'content-type':'image/png'},body:Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xm1sAAAAASUVORK5CYII=','base64')}).as('graphic');
  cy.intercept(endpoint('approve'),req => { state.status = 'approved'; req.reply({id:run.id}); }).as('approval');
  signIn();
  cy.contains('button','New test run').click();
  cy.contains('button','Run remaining stages').click();
  cy.wait('@graphic');
  cy.get('#pipeline li').filter(':contains("Complete")').should('have.length',5);
  cy.contains('Verified caption').should('be.visible');
  cy.on('window:confirm',() => true);
  cy.contains('button','Approve revision 1').click();
  cy.wait('@approval').its('request.body').should('deep.equal',{revision:1,payloadHash:hash,target});
  cy.get('#detail').contains('approved').should('be.visible');
});
it('surfaces a brand hold and prevents the approval action', () => {
  cy.intercept(endpoint('list'),{runs:[run]});
  cy.intercept(endpoint('get'),{...run,status:'review',next_stage:6,review:{...review,brand:'HOLD',issues:['Master brand assets required.']},
    packet:{...packet,readiness:'BLOCKED'}});
  cy.intercept(endpoint('image'),{statusCode:200,headers:{'content-type':'image/png'},body:Cypress.Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xm1sAAAAASUVORK5CYII=','base64')});
  signIn();
  cy.get('#runs').contains(run.id).click();
  cy.contains('brand HOLD').should('be.visible');
  cy.contains('Master brand assets required.').should('be.visible');
  cy.contains('button','Approve revision 1').should('not.exist');
  cy.contains('button','Request changes').should('be.visible');
});
