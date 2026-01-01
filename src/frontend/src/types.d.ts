
declare module 'react-cytoscapejs' {
    import { Component } from 'react';
    import cytoscape from 'cytoscape';

    export default class CytoscapeComponent extends Component<any> {
        static normalizeElements(data: any): any;
    }
}
