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
        console.log('data re', e.data);
        const predicates = getPredicatesFromVegaSignals(filters, currentSpace.dimensions, []);
        const de = new DataExplainer(dataSource);
        de.setDimensions(dimensions).setMeasures(measures).preAnalysis();
        // const ansSpaces: Insight.InsightSpace[] = [];
        const ansSpaces = [];
        const dimSelectionSpaces = de.explainBySelection(
            predicates,
            currentSpace.dimensions,
            currentSpace.measures,
            5
        );
        const meaSelectionSpaces = de.explainByCorMeasures(
            predicates,
            currentSpace.dimensions,
            currentSpace.measures,
            5
        );
        const childrenSpaces = de.explainByChildren(
            [],
            currentSpace.dimensions,
            currentSpace.measures,
            5
        );

        dimSelectionSpaces.forEach((space) => {
            ansSpaces.push({
                dimensions: [...space.dimensions, ...currentSpace.dimensions],
                measures: currentSpace.measures,
                significance: space.score,
                type: 'selection_dim_distribution',
                description: space,
            });
        });
        meaSelectionSpaces.forEach((space) => {
            ansSpaces.push({
                dimensions: currentSpace.dimensions,
                measures: space.measures,
                significance: space.score,
                type: 'selection_mea_distribution',
                description: space,
            });
        });
        childrenSpaces.majorList.forEach((space) => {
            ansSpaces.push({
                dimensions: [...currentSpace.dimensions, ...space.dimensions],
                measures: currentSpace.measures,
                significance: space.score,
                type: 'children_major_factor',
                description: space,
            });
        });
        childrenSpaces.outlierList.forEach((space) => {
            ansSpaces.push({
                dimensions: [...currentSpace.dimensions, ...space.dimensions],
                measures: currentSpace.measures,
                significance: space.score,
                type: 'children_outlier',
                description: space,
            });
        });
        self.postMessage(ansSpaces.filter(s => s.significance > 0.8))
    } catch (error) {
        console.error(error);
        self.postMessage([])
    }
}

self.addEventListener('message', getExplaination, false);
