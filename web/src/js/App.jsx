import 'whatwg-fetch';
import _ from 'lodash';
import { API, wrapRequest } from './_config';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import { Row, Col, Jumbotron, Button, PageHeader, Modal, FormGroup, FormControl, ControlLabel, Checkbox, ButtonToolbar, Alert } from 'react-bootstrap';
import AnimatedNumber from 'react-animated-number';
import Check from 'react-icons/lib/io/checkmark-round';
import numeral from 'numeral';
import React, { Component } from 'react';

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
		this.interval = setInterval(() =>
			fetch(API + 'discover', wrapRequest()).then(response => response.json()).then(json => this.setState({ discover: json }))
				.then(fetch(API + 'info', wrapRequest()).then(response => response.json()).then(json => this.setState({ info: json })))
			, 5000);
	}

	componentWillUnmount() {
		clearInterval(this.interval);
	}

	close() {
		this.setState({ open: false });
	}

	open(row, isSelected, e) {
		console.log(this.state.open)
		this.setState({ selected: row, open: true })
	}



	nameFormatter = (cell, row) => {
		return (
			<span>
				<div><strong>{row.name}</strong></div>
				<div className="visible-xs text-muted">&nbsp;{row.addr}</div>
			</span>
		);
	}


	trackedFormatter = (cell, row) => {
		return (<span>{row.tracked ? <Check /> : null}</span>
		);
	}


	handleChange(e) {
		var newSelected = _.extend({}, this.state.selected);
		newSelected.name = e.target.value;
		this.setState({ selected: newSelected });
	}

	handleTracking(tracked) {
		var newSelected = _.extend({}, this.state.selected);
		newSelected.tracked = tracked;
		this.setState({ selected: newSelected });
	}
	render() {
		const selectRow = {
			mode: 'radio',
			hideSelectColumn: true,
			bgColor: '#fdece8',
			clickToSelect: true,
			onSelect: this.open.bind(this)
		};
		console.log(this.state.discover)
		return (
			<span>
				<Modal show={this.state.open} onHide={this.close.bind(this)}>
					<Modal.Header closeButton >
						<Modal.Title>{this.state.selected ? "Update " + this.state.selected.addr : "Update Device"}</Modal.Title>
					</Modal.Header>
					<Modal.Body>
						<Alert bsStyle={this.state.tracking ? "info" : "warning"}>
							<strong className="text-md">Tracking {this.state.tracking ? "On" : "Off"}</strong>
							{this.state.tracking
								? <p>While the tracking off you will not be able to see real-time data for this device</p>
								: <p>While the tracking on you are able to see real-time data for this device</p>}

						</Alert>
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
							<p>Enabling tracking will allow the site to collect real-time location data for this device</p>
							<FormGroup controlId="formBasicText">
								<ButtonGroup>
									<Button bsStyle={this.state.selected && this.state.selected.tracked ? "primary" : null} onClick={() => this.handleTracking(true)}>Tracking</Button>
									<Button bsStyle={this.state.selected && this.state.selected.tracked ? null : "primary"} onClick={() => this.handleTracking(false)}>No Tracking</Button>
								</ButtonGroup>
							</FormGroup>
						</form>
					</Modal.Body>
					<Modal.Footer>
						<Button onClick={this.close.bind(this)}>Close</Button>
						<Button bsStyle="primary" onClick={this.close.bind(this)}>Update</Button>
					</Modal.Footer>
				</Modal>

				<Row>
					<Col lg={6} lgOffset={3} md={8} mdOffset={2} sm={10} smOffset={1} className="p-a-md">
						<PageHeader>
							<span className="text-muted">ZING</span> <strong>RELAY</strong>
							<span className="pull-right">
								<tt className="text-muted text-xs">{this.state.info ? this.state.info.mac : null}</tt>
								<tt className="text-muted text-xs">{this.state.info ? " (v" + this.state.info.version + ")" : null}</tt>
							</span>
						</PageHeader>
						<Jumbotron className="p-a r-a">
							<h1 className="server-site text-center"><strong>{this.state.info && this.state.info.mqtt ? this.state.info.mqtt.access.siteKey : "-"}</strong></h1>
							<h3 className="server-status text-center"><strong className={this.state.info && this.state.info.mqtt.status == 'connected' ? "success" : "danger"}>{this.state.info && this.state.info.mqtt ? "Server " + this.state.info.mqtt.status : "Server Disconnected"}</strong></h3>
							<h4 className="server-status text-center text-muted"><strong><AnimatedNumber value={this.state.info && this.state.info.mqtt ? this.state.info.mqtt.count : 0}
								style={{
									transition: '0.8s ease-out',
									transitionProperty: 'background-color, color, opacity'
								}}
								stepPrecision={0}
								formatValue={n => { return numeral(n).format('0,0') }}
								duration={300} /> Messages</strong></h4>
						</Jumbotron>
						<BootstrapTable data={this.state.discover} striped={true} hover={true} selectRow={selectRow} bordered={false} options={{ defaultSortName: 'rssi' }}>
							<TableHeaderColumn dataField="addr" isKey={true} dataSort={true} className="hidden-xs" columnClassName='hidden-xs'>Address</TableHeaderColumn>
							<TableHeaderColumn dataField="tracked" dataSort={true} dataFormat={this.trackedFormatter} dataAlign="center">Tracked</TableHeaderColumn>
							<TableHeaderColumn dataField="name" dataFormat={this.nameFormatter} dataSort={true}>Name</TableHeaderColumn>
							<TableHeaderColumn dataField="rssi" dataSort={true} dataAlign="right">RSSI</TableHeaderColumn>
							<TableHeaderColumn dataField="count" dataSort={true} dataAlign="right">Count</TableHeaderColumn>
						</BootstrapTable>
					</Col>
				</Row>
			</span>
		);
	}
}
