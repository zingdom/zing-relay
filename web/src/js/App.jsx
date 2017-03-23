import 'whatwg-fetch';
import React, { Component } from 'React';
import { Row, Col, Jumbotron, Button, PageHeader } from 'react-bootstrap';
import { API, wrapRequest } from './_config';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import numeral from 'numeral';

export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    componentWillMount() {
        fetch(API + 'discover', wrapRequest()).then(response => response.json()).then(json => this.setState({ discover: json }));
        this.interval = setInterval(() => fetch(API + 'discover', wrapRequest()).then(response => response.json()).then(json => this.setState({ discover: json })), 10000);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    rssiFormatter = (cell, row) => {
        return (
            <div >
                {numeral(row.rssi_total / row.rssi_count).format('0.0')}</div>
        );
    }

    nameFormatter = (cell, row) => {
        return (
            <span>
                <div> <strong>{row.name}</strong></div>
                <div className="visible-xs text-muted"> {row.addr}</div>
            </span>
        );
    }
    render() {
        return (
            <Row>
                <Col md={6} mdOffset={3} className="p-a-md">
                    <PageHeader>
                        <h2><span className="text-muted">ZING</span> <strong>RELAY</strong></h2>
                        <div className="pull-right" id="relay-info" />
                    </PageHeader>

                    <Jumbotron className="p-a r-a">
                        <h1>Server Disconnected</h1>
                        <p>Cras justo odio, dapibus ac facilisis in, egestas eget quam. Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum
					nibh, ut fermentum massa justo sit amet risus.</p>
                    </Jumbotron>
                    <BootstrapTable data={this.state.discover} striped={true} hover={true} selectRow={{ mode: 'checkbox' }} bordered={ false }>
                        <TableHeaderColumn dataField="addr" isKey={true} dataSort={true} className="hidden-xs" columnClassName='hidden-xs'>Address</TableHeaderColumn>
                        <TableHeaderColumn dataField="name" dataFormat={this.nameFormatter} dataSort={true}>Name</TableHeaderColumn>
                        <TableHeaderColumn dataField="rssi_total" dataSort={true} dataFormat={this.rssiFormatter} dataAlign="right">RSSI</TableHeaderColumn>
                        <TableHeaderColumn dataField="rssi_count" dataSort={true} dataAlign="right">Count</TableHeaderColumn>
                    </BootstrapTable>
                </Col>
            </Row>
        );
    }
}
