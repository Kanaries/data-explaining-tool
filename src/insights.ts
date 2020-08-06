import { Insight } from 'visual-insights';
import { Record } from './interfaces';
import { checkMajorFactor, getPredicates, filterByPredicates, checkChildOutlier, IPredicate } from './utils';
import { normalizeWithParent, compareDistribution, normalizeByMeasures, getDistributionDifference } from './utils/normalization';
export interface IExplaination {
    dimensions: string[];
    measures: string[];
    extendDs: string[];
    extendMs: string[];
    type: string;
    score: number;
    description: any;
    predicates: IPredicate[];
}
export class DataExplainer {
    public dataSource: Record[];
    private dimensions: string[];
    private measures: string[];
    private engine: Insight.VIEngine;
    constructor (dataSource: Record[] = []) {
        this.engine = new Insight.VIEngine();
        this.dataSource = dataSource;
        this.dimensions = [];
        this.measures = [];
        let keys: string[] = [];
        if (dataSource.length > 0) {
            keys = Object.keys(dataSource[0]);
        }
        this.engine.setDataSource(dataSource)
            .setFieldKeys(keys)
            .buildfieldsSummary();
        // const newKeys = this.engine.fields.filter(f => f.domain.size < 40).map(f => f.key);
        // this.engine.setFieldKeys(keys);
        // const keys = Object.keys(dataSource[0])
    }
    public setDimensions (dimensions: string[]) {
        this.dimensions = dimensions;
        this.engine.setDimensions(dimensions);
        return this;
    }
    public setMeasures (measures: string[]) {
        this.measures = measures;
        this.engine.setMeasures(measures);
        return this;
    }
    public preAnalysis() {
        this.engine.buildGraph()
            .clusterFields()
            .buildSubspaces()
            .buildCube();
        return this;
    }
    public explain (predicates: IPredicate[], dimensions: string[], measures: string[], threshold: number = 0.2): IExplaination[] {
        // const predicates = getPredicates(selection, dimensions, measures);
        // 讨论：知道selection，但是分析的维度是什么？
        const dimSelectionSpaces = this.explainBySelection(
            predicates,
            dimensions,
            measures,
            5
        );
        const meaSelectionSpaces = this.explainByCorMeasures(
            predicates,
            dimensions,
            measures,
            5
        );
        const childrenSpaces = this.explainByChildren(
            [],
            dimensions,
            measures,
            5
        );
        const ansSpaces: IExplaination[] = [];
        dimSelectionSpaces.forEach((space) => {
            ansSpaces.push({
                dimensions,
                extendDs: space.dimensions,
                measures,
                extendMs: [],
                score: space.score,
                type: 'selection_dim_distribution',
                description: space,
                predicates
            });
        });
        meaSelectionSpaces.forEach((space) => {
            ansSpaces.push({
                dimensions: dimensions,
                extendDs: [],
                extendMs: space.measures,
                measures,
                score: space.score,
                type: 'selection_mea_distribution',
                description: space,
                predicates
            });
        });
        childrenSpaces.majorList.forEach((space) => {
            ansSpaces.push({
                dimensions,
                extendDs: space.dimensions,
                measures,
                extendMs: [],
                score: space.score,
                type: 'children_major_factor',
                description: space,
                predicates
            });
        });
        childrenSpaces.outlierList.forEach((space) => {
            ansSpaces.push({
                dimensions,
                extendDs: space.dimensions,
                measures,
                extendMs: [],
                score: space.score,
                type: 'children_outlier',
                description: space,
                predicates
            });
        });
        return ansSpaces.filter(space => space.score >= threshold);
    }
    public explainByChildren(predicates: IPredicate[], dimensions: string[], measures: string[], K_Neighbor: number = 3) {
        // 1. find most relative dimensions(topK)
        // 2. for each dimension, we check all the dim member in it. find the member whos distribution is most close to current one.
        // here we do not nomorlize all the dim member's distribution, we use the relative distribution instead.
        // 3. the dim member we found can be used to explain current one as major factor.
        // const predicates: IPredicate[] = selection === 'all' ? [] : getPredicates(selection, dimensions, []);
        // console.log(predicates)
        const parentCuboid = this.engine.cube.getCuboid(dimensions);
        const parentData = filterByPredicates(parentCuboid.state, predicates);
        // console.log(parentData)
        const knn = this.getKNN('dimension', dimensions, K_Neighbor);
        const majorList: Array<{key: string; score: number; dimensions: string[]}> = [];
        const outlierList: Array<{key: string; score: number; dimensions: string[]}> = [];
        for (let extendDim of knn) {
            const cuboid = this.engine.cube.getCuboid([...dimensions, extendDim]);
            const data = filterByPredicates(cuboid.state, predicates);
            let groups: Map<any, Record[]> = new Map();
            for (let record of data) {
                if (!groups.has(record[extendDim])) {
                    groups.set(record[extendDim], [])
                }
                groups.get(record[extendDim])?.push(record)
            }
            const { majorKey, majorSum } = checkMajorFactor(parentData, groups, dimensions, measures)
            majorList.push({ key: majorKey, score: majorSum, dimensions: [extendDim] })
            const { outlierKey, outlierSum } = checkChildOutlier(parentData, groups, dimensions, measures);
            outlierList.push({ key: outlierKey, score: outlierSum, dimensions: [extendDim] })
        }
        majorList.sort((a, b) => a.score - b.score);
        outlierList.sort((a, b) => b.score - a.score);
        return {
            majorList,
            outlierList
        };
    }
    public explainBySelection(predicates: IPredicate[], dimensions: string[], measures: string[], K_Neighbor: number = 3) {
        // const predicates = getPredicates(selection, dimensions, []);
        // const parentCuboid = this.engine.cube.getCuboid()
        const knn = this.getKNN('dimension', dimensions, K_Neighbor);
        const majorList: Array<{ score: number; dimensions: string[] }> = [];
        const outlierList: Array<{ score: number; dimensions: string[] }> = [];
        for (let extendDim of knn) {
            const parentCuboid = this.engine.cube.getCuboid([extendDim])
            const cuboid = this.engine.cube.getCuboid([...dimensions, extendDim])
            const overallData = parentCuboid.state;
            const subData = filterByPredicates(cuboid.state, predicates);

            let outlierNormalization = normalizeWithParent(subData, overallData, measures, false);

            let outlierScore = compareDistribution(
                outlierNormalization.normalizedData,
                outlierNormalization.normalizedParentData,
                [extendDim],
                measures
            );
            outlierScore /= (measures.length * 2)
            outlierList.push({
                dimensions: [extendDim],
                score: outlierScore
            })
            // compare overall and subdata. set score. (major and outlier)
        }
        outlierList.sort((a, b) => b.score - a.score)
        return outlierList;
    }
    public explainByCorMeasures(predicates: IPredicate[], dimensions: string[], measures: string[], K_Neighbor: number = 3) {
        // const predicates = getPredicates(selection, dimensions, []);
        // const parentCuboid = this.engine.cube.getCuboid()
        const knn = this.getKNN('measure', measures, K_Neighbor);
        const ans: Array<{ score: number; dimensions: string[]; measures: string[]; max: number;  min: number }> = [];
        const cuboid = this.engine.cube.getCuboid(dimensions);
        const normalizedState = normalizeByMeasures(cuboid.state, [...knn, ...measures]);
        for (let extendMea of knn) {
            let maxDiff = 0;
            let minDiff = 1;
            for (let baseMeasure of measures) {
                let diffScore = getDistributionDifference(normalizedState, dimensions, baseMeasure, extendMea) / 2;
                maxDiff = Math.max(maxDiff, diffScore);
                minDiff = Math.min(minDiff, diffScore);
            }
            ans.push({
                dimensions,
                score: Math.max(1 - minDiff, maxDiff),
                measures: [extendMea],
                max: maxDiff,
                min: minDiff
            })
            // compare overall and subdata. set score. (major and outlier)
        }
        ans.sort((a, b) => b.score - a.score);
        return ans;
    }
    public getKNN(type: 'dimension' | 'measure', fields: string[], K_Neighbor: number = 3, threshold = 0) {
        const adjMatrix = type === 'dimension' ? this.engine.dataGraph.DG : this.engine.dataGraph.MG;
        const graphFields = type === 'dimension' ? this.engine.dataGraph.dimensions : this.engine.dataGraph.measures;
        const fieldIndices = fields.map(field => {
            let index = graphFields.indexOf(field);
            if (index === -1) {
                // TODO: provide a better solution for group dimension.
                index = graphFields.indexOf(field + '(group)')
            }
            return index;
        });
        const neighbors: Array<{dis: number, index: number, imp: number}> = [];
        for (let fieldIndex of fieldIndices) {
            for (let i = 0; i < adjMatrix[fieldIndex].length; i++) {
                if (!fieldIndices.includes(i)) {
                    const dis = Math.abs(adjMatrix[fieldIndex][i]);
                    const fieldKey = graphFields[i];
                    const tf = this.engine.fields.find(f => f.key === fieldKey);
                    if (dis >= threshold) {
                        neighbors.push({
                            dis,
                            index: i,
                            imp: tf?.domain.size || Infinity,
                        });
                    }
                }
            }
        }

        neighbors.sort((a, b) => b.dis / b.imp - a.dis / a.imp);
        return neighbors.slice(0, K_Neighbor).map(f => graphFields[f.index]);
    }
    public getVisSpec (spaces: IExplaination[]) {
        const engine = this.engine;
        return spaces.map(space => {
            let visSpace: Insight.InsightSpace;
            if (space.type === 'children_major_factor' || space.type === 'children_outlier') {
                visSpace = {
                    dimensions: [...space.extendDs, ...space.dimensions],
                    measures: space.extendMs.length > 0 ? space.extendMs : space.measures,
                    significance: space.score,
                    score: space.score,
                    description: space.description,
                };
            } else {
                visSpace = {
                    dimensions: space.extendDs.length > 0 ? space.extendDs : space.dimensions,
                    measures: space.extendMs.length > 0 ? space.extendMs : space.measures,
                    significance: space.score,
                    score: space.score,
                    description: space.description,
                };
            }
            return {
                schema: engine.specification(visSpace).schema,
                dataView: engine.cube.getCuboid([...space.dimensions, ...space.extendDs]).state
            };
        })
    }
}