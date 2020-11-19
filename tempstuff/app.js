const { Component, mount, tags } = owl;

const xml = tags ? tags.xml : owl.xml;

let idCounter = 1;
const adjectives = ["pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain", "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd", "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"],
  colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"],
  nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function _random (max) { return Math.round(Math.random() * 1000) % max; };

function buildData(count) {
  let data = new Array(count);
  for (let i = 0; i < count; i++) {
      const label = `${adjectives[_random(adjectives.length)]} ${colours[_random(colours.length)]} ${nouns[_random(nouns.length)]}`;
    data[i] = {
      id: idCounter++,
      label,
    }
  }
  return data;
}

const data = buildData(10000);


// Owl Components
class App extends Component {
  static template = xml`
  <div class='container'>
  <div class='jumbotron' t-debug="">
    <div class='row'>
      <div class='col-md-6'>
        <h1>Owl Keyed</h1>
      </div>
      <div class='col-md-6'>
        <div class='row'>
        </div>
      </div>
    </div>
  </div>
  <table class='table table-hover table-striped test-data'>
    <tbody>
      <t t-foreach="rows" t-as="row" t-key="row.id">
        <tr t-att-class="row.id === selectedRowId ? 'danger' : ''">
            <td class="col-md-1" t-esc="row.id" />
            <td class="col-md-4">
                <a t-on-click="selectRow(row.id)" t-esc="row.label" />
            </td>
            <td class="col-md-1">
                <a t-on-click="removeRow(row.id)">
                  <span class='glyphicon glyphicon-remove' aria-hidden="true" />
                </a>
            </td>
            <td class='col-md-6'/>
        </tr>
      </t>
    </tbody>
  </table>
  <span class='preloadicon glyphicon glyphicon-remove' aria-hidden="true" />
</div>
  `;
  rows = data;
}

async function start() {
    console.time("mount");
    await mount(App, {target: document.body });
    console.timeEnd("mount");
}

start();