import { Record } from './interfaces';
import { Insight } from 'visual-insights';
/* eslint import/no-webpack-loader-syntax:0 */
// @ts-ignore
// eslint-disable-next-line
import InsightSpaceWorker from './workers/InsightService.worker';

function workerService<T, R>(worker: Worker, data: R): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    worker.postMessage(data);
    worker.onmessage = (e: MessageEvent) => {
      resolve(e.data);
    };
    worker.onerror = (e: ErrorEvent) => {
      reject({
        success: false,
        message: e.error,
      });
    };
  });
}
interface InsightParams {
  dataSource: Record;
  dimensions: string[];
  measures: string[];
  max_dimension_num_in_view: number;
  max_measure_num_in_view: number
}
export async function getInsightSpaces(props: InsightParams) {
  const worker = new InsightSpaceWorker();
  let result: Insight.InsightSpace[] = []
  try {
    result = await workerService<Insight.InsightSpace[], InsightParams>(worker, props)
    return result
  } catch (error) {
    console.error(error);   
  }
  worker.terminate();
  return result;
}
