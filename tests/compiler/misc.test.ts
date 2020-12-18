import { snapshotTemplateCode, TestApp, trim } from "../helpers";

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

describe("misc", () => {
  test("global", () => {
    const app = new TestApp();
    const _calleeAsc = `<año t-att-falló="'agüero'" t-raw="0"/>`;
    const _calleeUsesFoo = `<span t-esc="foo">foo default</span>`;
    const _calleeAscToto = `<div t-raw="toto">toto default</div>`;
    const caller = `
        <div>
          <t t-foreach="[4,5,6]" t-as="value" t-key="value">
            <span t-esc="value"/>
            <t t-call="_callee-asc">
              <t t-call="_callee-uses-foo">
                  <t t-set="foo" t-value="'aaa'"/>
              </t>
              <t t-call="_callee-uses-foo"/>
              <t t-set="foo" t-value="'bbb'"/>
              <t t-call="_callee-uses-foo"/>
            </t>
          </t>
          <t t-call="_callee-asc-toto"/>
        </div>`;
    app.addTemplate("_callee-asc", _calleeAsc);
    app.addTemplate("_callee-uses-foo", _calleeUsesFoo);
    app.addTemplate("_callee-asc-toto", _calleeAscToto);
    app.addTemplate("caller", caller);

    snapshotTemplateCode(caller);
    snapshotTemplateCode(_calleeAscToto);
    snapshotTemplateCode(_calleeAsc);
    snapshotTemplateCode(_calleeUsesFoo);

    const result = trim(app.renderToString("caller"));
    const expected = trim(`
        <div>
          <span>4</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <span>5</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <span>6</span>
          <año falló="agüero">
            <span>aaa</span>
            <span>foo default</span>
            <span>bbb</span>
          </año>
  
          <div>toto default</div>
        </div>
      `);
    expect(result).toBe(expected);
  });


  test("complex template", () => {
    const template = `
      <div t-attf-class="batch_tile {{options.more? 'more' : 'nomore'}}">
        <div t-attf-class="card bg-{{klass}}-light">
          <div class="batch_header">
              <a t-attf-href="/runbot/batch/{{batch.id}}" t-attf-class="badge badge-{{batch.has_warning ? 'warning' : 'light'}}" title="View Batch">
                  <t t-esc="batch.formated_age"/>
                  <i class="fa fa-exclamation-triangle" t-if="batch.has_warning"/>
                  <i class="arrow fa fa-window-maximize"/>
              </a>
          </div>
          <t t-if="batch.state=='preparing'">
              <span><i class="fa fa-cog fa-spin fa-fw"/> preparing</span>
          </t>
          <div class="batch_slots">
              <t t-foreach="batch.slot_ids.filter(slot => slot.build_id.id and !slot.trigger_id.manual and (options.trigger_display[slot.trigger_id.id]))" t-as="slot" t-key="slot.id">
                  <SlotButton class="slot_container" slot="slot"/>
              </t>
              <div class="slot_filler" t-foreach="[1, 2, 3, 4]" t-as="x" t-key="x"/>
          </div>
          <div class="batch_commits">
              <div t-foreach="commit_links" t-as="commit_link" class="one_line" t-key="commit_link.id">
                  <a t-attf-href="/runbot/commit/{{commit_link.commit_id}}" t-attf-class="badge badge-light batch_commit match_type_{{commit_link.match_type}}">
                  <i class="fa fa-fw fa-hashtag" t-if="commit_link.match_type == 'new'" title="This commit is a new head"/>
                  <i class="fa fa-fw fa-link" t-if="commit_link.match_type == 'head'" title="This commit is an existing head from bundle branches"/>
                  <i class="fa fa-fw fa-code-fork" t-if="commit_link.match_type == 'base_match'" title="This commit is matched from a base batch with matching merge_base"/>
                  <i class="fa fa-fw fa-clock-o" t-if="commit_link.match_type == 'base_head'" title="This commit is the head of a base branch"/>
                  <t t-esc="commit_link.commit_dname"/>
                  </a>
                  <a t-att-href="'https://%s/commit/%s' % (commit_link.commit_remote_url, commit_link.commit_name)" class="badge badge-light" title="View Commit on Github"><i class="fa fa-github"/></a>
                  <span t-esc="commit_link.commit_subject"/>
              </div>
          </div>
        </div>
      </div>`;
    
      snapshotTemplateCode(template);
      // const expected = `<div> - first (0)  - (1)  - (2)  - (3)  - last (4) </div>`;
      // expect(renderToString(template)).toBe(expected);
  });
});

