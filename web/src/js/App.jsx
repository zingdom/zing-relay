import 'whatwg-fetch';
import React, { Component } from 'React';
import { Row, Col, Jumbotron, Button, PageHeader, Modal, FormGroup, FormControl, ControlLabel, Checkbox } from 'react-bootstrap';
import { API, wrapRequest } from './_config';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import numeral from 'numeral';
import _ from 'lodash';

export default class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            open: false
        };
    }

    componentWillMount() {
        fetch(API + 'discover', wrapRequest()).then(response => response.json()).then(json => this.setState({ discover: json }));
        fetch(API + 'info', wrapRequest()).then(response => response.json()).then(json => this.setState({ info: json }));
        this.interval = setInterval(() => fetch(API + 'discover', wrapRequest()).then(response => response.json()).then(json => this.setState({ discover: json })), 5000);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    close() {
        this.setState({ open: false });
    }


    handleRowSelect(row, isSelected, e) {
        console.log(this.state.open)
        this.setState({ selected: row, open: true })
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


    handleChange(e) {
        var newSelected = _.extend({}, this.state.selected);
        newSelected.name = e.target.value;
        this.setState({ selected: newSelected });
    }
    render() {
        const selectRow = {
            mode: 'radio',
            hideSelectColumn: true,
            bgColor: '#fdece8',
            clickToSelect: true,
            onSelect: this.handleRowSelect.bind(this)
        };
        console.log(this.state.info);
        return (
            <span>
                <Modal show={this.state.open} onHide={this.close.bind(this)}>
                    <Modal.Header closeButton>
                        <Modal.Title>Register Device</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <form>
                            <FormGroup controlId="formBasicText">
                                <ControlLabel>Device Name</ControlLabel>
                                <FormControl
                                    type="text"
                                    defaultValue={this.state.selected ? this.state.selected.name : null}
                                    placeholder="Enter text"
                                    onChange={this.handleChange.bind(this)}
                                />
                                <FormControl.Feedback />
                            </FormGroup>
                            <FormGroup controlId="formBasicText">

                                <Checkbox checked >Tracking</Checkbox>
                            </FormGroup>
                        </form>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={this.close.bind(this)}>Close</Button>
                        <Button bsStyle="primary" onClick={this.close.bind(this)}>Register</Button>
                    </Modal.Footer>
                </Modal>
                <Row>
                    <Col md={6} mdOffset={3} className="p-a-md">
                        <PageHeader>
                            <span className="text-muted">ZING</span> <strong>RELAY</strong>
                            <span className="pull-right">
                                <tt className="text-muted text-xs">{this.state.info ? this.state.info.mac : null}</tt>
                                <tt className="text-muted text-xs">{this.state.info ? " (v" + this.state.info.version + ")" : null}</tt>
                            </span>
                        </PageHeader>
                        <Jumbotron className="p-a r-a">
                            <h1>Server Disconnected</h1>
                            <p>Cras justo odio, dapibus ac facilisis in, egestas eget quam. Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum
					nibh, ut fermentum massa justo sit amet risus.</p>
                        </Jumbotron>
                        <BootstrapTable data={this.state.discover} striped={true} hover={true} selectRow={selectRow} bordered={false}>
                            <TableHeaderColumn dataField="addr" isKey={true} dataSort={true} className="hidden-xs" columnClassName='hidden-xs'>Address</TableHeaderColumn>
                            <TableHeaderColumn dataField="name" dataFormat={this.nameFormatter} dataSort={true}>Name</TableHeaderColumn>
                            <TableHeaderColumn dataField="rssi_total" dataSort={true} dataFormat={this.rssiFormatter} dataAlign="right">RSSI</TableHeaderColumn>
                            <TableHeaderColumn dataField="rssi_count" dataSort={true} dataAlign="right">Count</TableHeaderColumn>
                        </BootstrapTable>
                    </Col>
                </Row>
            </span>
        );
    }
}
