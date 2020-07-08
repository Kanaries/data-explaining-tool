/* eslint no-restricted-globals: 0 */
import { Insight } from 'visual-insights';
const generateInsightSpaces = async e => {
  const {
    dimensions,
    measures,
    dataSource,
    max_dimension_num_in_view,
    max_measure_num_in_view
  } = e.data;
  try {
    const result = await Insight.getVisSpaces({
      dimensions,
      measures,
      dataSource,
      max_dimension_num_in_view,
      max_measure_num_in_view,
    });
    self.postMessage(result)
  } catch (err) {
    console.error(err)
    self.postMessage([])
  }
}

self.addEventListener('message', generateInsightSpaces, false);
