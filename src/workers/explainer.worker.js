/* eslint no-restricted-globals: 0 */
/* eslint-disable */ 
import { Record, Filters } from '../interfaces';
import { getPredicatesFromVegaSignals } from '../utils';
import { DataExplainer } from '../insights';
import { Insight } from 'visual-insights';

// interface ReqData {
//     dimensions: string[];
//     measures: string[];
//     dataSource: Record[];
//     filters?: Filters;
//     currentSpace: {
//         dimensions: string[];
//         measures: string[];
//     }
// }

// function getExplaination(e: MessageEvent): Insight.InsightSpace[] {
function getExplaination(e) {
    try {
        const { dimensions, measures, dataSource, filters = {}, currentSpace } = e.data; // as ReqData;
        const predicates = getPredicatesFromVegaSignals(filters, currentSpace.dimensions, []);
        const de = new DataExplainer(dataSource);
        de.setDimensions(dimensions).setMeasures(measures).preAnalysis();
        // const ansSpaces: Insight.InsightSpace[] = [];
        const ansSpaces = de.explain(predicates, currentSpace.dimensions, currentSpace.measures);
        const visSpaces = de.getVisSpec(ansSpaces);
        const fields = de.engine.fields;
        self.postMessage({
            explainations: ansSpaces,
            visSpaces,
            fieldsWithSemanticType: fields.map(f => ({
                key: f.key,
                type: f.semanticType
            }))
        }); 
    } catch (error) {
        console.error(error);
        self.postMessage([])
    }
}

self.addEventListener('message', getExplaination, false);
