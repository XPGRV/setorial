import './data-utils.jsx'
import './upload.jsx'
import './seasonal-chart.jsx'
import './ciclo-boi.jsx'
import './beef-us-tab.jsx'
import './production-chart.jsx'
import './bimonthly-chart.jsx'
import './continuous-chart.jsx'
import './poultry-br-tab.jsx'
import './poultry-us-tab.jsx'
import './macro-tab.jsx'
import './app.jsx'

export default function ProteinasApp({ initialData, initialMeta }) {
  return <window.App initialData={initialData} initialMeta={initialMeta} />
}
