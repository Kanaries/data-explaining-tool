import { Insight } from 'visual-insights';
import { Record } from './interfaces';
import { checkMajorFactor, getPredicates, filterByPredicates, checkChildOutlier, IPredicate } from './utils';
import { normalizeWithParent, compareDistribution } from './utils/normalization';

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
    public explain (selection: Record[], dimensions: string[], measures: string[]) {
        const predicates = getPredicates(selection, dimensions, measures);
        // 讨论：知道selection，但是分析的维度是什么？
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
        const knn = this.getKNN(dimensions, K_Neighbor);
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
        const knn = this.getKNN(dimensions, K_Neighbor);
        const majorList: Array<{ score: number; dimensions: string[] }> = [];
        const outlierList: Array<{ score: number; dimensions: string[] }> = [];
        for (let extendDim of knn) {
            const parentCuboid = this.engine.cube.getCuboid([extendDim])
            const cuboid = this.engine.cube.getCuboid([...dimensions, extendDim])
            const overallData = parentCuboid.state;
            const subData = filterByPredicates(cuboid.state, predicates);

            let outlierNormalization = normalizeWithParent(subData, overallData, measures, false);

            const outlierScore = compareDistribution(
                outlierNormalization.normalizedData,
                outlierNormalization.normalizedParentData,
                [extendDim],
                measures
            );
            outlierList.push({
                dimensions: [extendDim],
                score: outlierScore
            })
            // compare overall and subdata. set score. (major and outlier)
        }
        return outlierList;
    }
    public explainByCorMeasures(predicates: IPredicate[], dimensions: string[], measures: string[], K_Neighbor: number = 3) {
        // const predicates = getPredicates(selection, dimensions, []);
        // const parentCuboid = this.engine.cube.getCuboid()
        const knn = this.getKNN(measures, K_Neighbor);
        const outlierList: Array<{ score: number; dimensions: string[], measures: string[] }> = [];
        for (let extendMea of knn) {
            const parentCuboid = this.engine.cube.getCuboid(dimensions)
            const cuboid = parentCuboid;
            const overallData = parentCuboid.state;
            const subData = filterByPredicates(cuboid.state, predicates);

            let outlierNormalization = normalizeWithParent(subData, overallData, measures, false);

            const outlierScore = compareDistribution(
                outlierNormalization.normalizedData,
                outlierNormalization.normalizedParentData,
                dimensions,
                measures
            );
            outlierList.push({
                dimensions: dimensions,
                score: outlierScore,
                measures: [extendMea]
            })
            // compare overall and subdata. set score. (major and outlier)
        }
        return outlierList;
    }
    public getKNN(dimensions: string[] ,K_Neighbor: number = 3) {
        const adjMatrix = this.engine.dataGraph.DG;
        const graphDimensions = this.engine.dataGraph.dimensions;
        const dimIndices = dimensions.map(dim => graphDimensions.indexOf(dim));
        const neighbors: Array<{dis: number, index: number}> = [];
        for (let dimIndex of dimIndices) {
            for (let i = 0; i < adjMatrix[dimIndex].length; i++) {
                if (!dimIndices.includes(i)) {
                    neighbors.push({
                        dis: Math.abs(adjMatrix[dimIndex][i]),
                        index: i
                    })
                }
            }
        }
        neighbors.sort((a, b) => b.dis - a.dis);
        return neighbors.slice(0, K_Neighbor).map(f => graphDimensions[f.index]);
    }
}