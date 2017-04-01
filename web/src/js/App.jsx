import React, { Component } from 'react';
import 'whatwg-fetch';
import _ from 'lodash';
import { API, wrapRequest } from './_config';
import { BootstrapTable, TableHeaderColumn } from 'react-bootstrap-table';
import { Row, Col, Jumbotron, Button, PageHeader, Modal, FormGroup, FormControl, ControlLabel, Alert, Popover, OverlayTrigger } from 'react-bootstrap';
import AnimatedNumber from 'react-animated-number';
import Check from 'react-icons/lib/io/toggle-filled';
import Uncheck from 'react-icons/lib/io/toggle';
import Info from 'react-icons/lib/io/ios-information';

import numeral from 'numeral';
import moment from 'moment';
require("moment-duration-format");

export default class App extends Component {
	constructor(props) {
		super(props);

		this.state = {
			popup: null,
			discover: []
		};
	}

	componentWillMount() {
		this.refresh();
	}

	refresh() {
		fetch(API + 'info', wrapRequest())
			.then(resp => resp.json())
			.then(json => this.setState({ info: json }))
			.then(() => fetch(API + 'discover', wrapRequest()))
			.then(resp => resp.json())
			.then(json => this.setState({ discover: json }))
			.then(() => {
				setTimeout(this.refresh.bind(this), 1000);
			})
			.catch(err => console.log(err));
	}

	popupOpen(row) {
		this.setState({
			popup: {
				updated: false,
				addr: row.addr,
				name: row.name,
				nameOrig: row.name,
				tracked: row.tracked,
				trackedOrig: row.tracked
			}
		});
	}

	popupHandleUpdate() {
		if (!this.state.popup.updated)
			return this.popupHandleClose();

		console.log('updating...');
		fetch(API + 'register', wrapRequest({
			method: 'POST',
			body: JSON.stringify({
				addr: this.state.popup.addr,
				name: this.state.popup.name,
				tracked: this.state.popup.tracked
			})
		}))
			.then(resp => resp.json())
			.then(json => {
				console.log(json);
				// TODO: display a success message
				return this.popupHandleClose();
			})
			.catch(err => {
				console.error(err);
				// TODO: display a failure message
				return this.popupHandleClose();
			});
	}

	popupHandleClose() {
		this.setState({ popup: null });
	}

	popupHandleNameChanged(e) {
		let newPopup = _.extend({}, this.state.popup);
		newPopup.name = e.target.value;
		newPopup.updated = newPopup.tracked !== newPopup.trackedOrig || newPopup.name !== newPopup.nameOrig;
		this.setState({ popup: newPopup });
	}

	popupHandleTrackingChanged(tracked) {
		let newPopup = _.extend({}, this.state.popup);
		newPopup.tracked = tracked;
		newPopup.updated = newPopup.tracked !== newPopup.trackedOrig || newPopup.name !== newPopup.nameOrig;
		this.setState({ popup: newPopup });
	}

	nameFormatter(cell, row) {
		return (
			<span>
				<div>{row.name ? (<strong className="text-md">{row.name}</strong>) : (<span className="text-muted">&nbsp;</span>)}</div>
				<div className="visible-xs text-muted addr">{row.addr}</div>
			</span>
		);
	}



	nameSort(a, b, order, field) {
		if (order === 'desc') {
			if (!a[field]) return 1;
			if (!b[field]) return -1;
			if (a[field] > b[field]) {
				return -1;
			} else if (a[field] < b[field]) {
				return 1;
			}
			return 0;
		}
		else {
			if (!a[field]) return -1;
			if (!b[field]) return 1;
			if (a[field] > b[field]) {
				return 1;
			} else if (a[field] < b[field]) {
				return -1;
			}
			return 0;
		}
	}

	trackedFormatter(cell, row) {
		return (
			<span>{row.tracked ? <Check size={44} /> : <Uncheck size={44} />}</span>
		);
	}

	countFormatter(cell, row) {
		return (
			<span className="text-sm">{numeral(row.count).format('0,0')}</span>
		);
	}

	rssiFormatter(cell, row) {
		return (
			<span className="text-sm ">{row.rssi}</span>
		);
	}

	render() {
		
		const popoverLeft = (
			<Popover id="popover-positioned-left" title="Relay Details" >
				<p><strong>Site:</strong> {this.state.info && this.state.info.mqtt ? this.state.info.mqtt.access.site.name : null}</p>
				<p><strong>Address:</strong> {this.state.info ? this.state.info.addr : null}</p>
				<p><strong>Version:</strong> {this.state.info ? this.state.info.version : null}</p>
  			</Popover>
		);
		var selectRow = {
			mode: 'radio',
			hideSelectColumn: true
		}
		if (this.state.info && this.state.info.mqtt) {
			selectRow = {
				mode: 'radio',
				hideSelectColumn: true,
				clickToSelect: true,
				onSelect: this.popupOpen.bind(this)
			}
		}

		var seconds = this.state.info ? this.state.info.ticks / 10 : 0;
		return (
			<span>
				{(() => {
					if (this.state.popup) {
						return (
							<Modal show={true} onHide={this.popupHandleClose.bind(this)}>
								<Modal.Header closeButton>
									<Modal.Title>{this.state.popup.nameOrig ? 'Update ' + this.state.popup.nameOrig : 'Update Device'}</Modal.Title>
								</Modal.Header>
								<Modal.Body>
									<Alert bsStyle={this.state.popup.tracked ? 'info' : 'warning'}>
										<strong className="text-md">Tracking {this.state.popup.tracked ? 'On' : 'Off'}</strong>
										<span className="f-r pointer">
											{this.state.popup.tracked
												? <Check size={64} onClick={() => this.popupHandleTrackingChanged(false)} />
												: <Uncheck size={64} onClick={() => this.popupHandleTrackingChanged(true)} />}
										</span>
										{this.state.popup.tracked
											? <p><strong>Transimitting</strong> real-time location data to the cloud</p>
											: <p><strong>Not Transimitting</strong> real-time location data to the cloud</p>}
									</Alert>
									<form>
										<FormGroup controlId="formBasicText">
											<ControlLabel>Device Name</ControlLabel>
											<FormControl
												type="text"
												autoComplete="off"
												defaultValue={this.state.popup.name ? this.state.popup.name : null}
												placeholder="Enter text"
												onChange={this.popupHandleNameChanged.bind(this)}
											/>
											<FormControl.Feedback />
										</FormGroup>
									</form>
								</Modal.Body>
								<Modal.Footer>
									<Button onClick={this.popupHandleClose.bind(this)}>Close</Button>
									<Button bsStyle={this.state.popup.updated ? 'primary' : null} onClick={this.popupHandleUpdate.bind(this)}>Update</Button>
								</Modal.Footer>
							</Modal>
						);
					}
				})()}
				<Row>
					<Col md={8} mdOffset={2} sm={10} smOffset={1} className="p-a-md">
						<PageHeader>
							<span className="text-muted">ZING</span> <strong>RELAY</strong>
							<span className="pull-right">
								 <OverlayTrigger trigger="click" placement="left" overlay={popoverLeft} rootClose={true}><Info size={30} /></OverlayTrigger>
							</span>
						</PageHeader>
						<Jumbotron className="p-a r-a">
							<h1 className="server-site text-center  m-b-0"><strong>{this.state.info ? this.state.info.name : null}</strong></h1>
							<h3 className="server-status text-center"><strong className={this.state.info && this.state.info.mqtt && this.state.info.mqtt.status == 'connected' ? 'success' : 'danger'}>{this.state.info && this.state.info.mqtt ? 'Server ' + this.state.info.mqtt.status : 'Server Disconnected'}</strong></h3>
							{this.state.info ?
								<Row>
									<Col md={4} xs={6}>
										<div className="stat  r-a p-a">
											<h1 className="server-status text-center text-muted"><strong>
												<AnimatedNumber value={this.state.info && this.state.info.mqtt ? this.state.info.mqtt.count : 0}
													style={{
														transition: '0.8s ease-out',
														transitionProperty: 'background-color, color, opacity'
													}}
													stepPrecision={0}
													formatValue={n => numeral(n).format('0,0')}
													duration={300} /></strong></h1>
											<h5 className="text-muted text-center upper detail">Messages</h5>
										</div>
									</Col>
									<Col md={4} xs={6}>
										<div className="stat  r-a p-a">
											<h1 className="server-status text-center text-muted"><strong>
												<AnimatedNumber value={this.state.info ? _.size(this.state.info.devices) : 0}
													style={{
														transition: '0.8s ease-out',
														transitionProperty: 'background-color, color, opacity'
													}}
													stepPrecision={0}
													formatValue={n => numeral(n).format('0,0')}
													duration={300} /></strong></h1>
											<h5 className="text-muted text-center upper detail">Tracked Devices</h5>
										</div>
									</Col>
									<Col md={4} xs={12}>
										<div className="stat  r-a p-a">
											<h1 className="text-center text-muted"><strong>
												{seconds < 600
													? moment.duration(seconds, "seconds").format('m[m] s[s]')
													: (seconds < 36000
														? moment.duration(seconds, "seconds").format('h[h] m[m]')
														: moment.duration(seconds, "seconds").format('d[d] h[h]'))}
											</strong>
											</h1>
											<h5 className="text-muted text-center upper detail">Uptime</h5>
										</div>
									</Col>
								</Row> : null}
						</Jumbotron>
						<BootstrapTable data={this.state.discover} striped={true} hover={true} selectRow={selectRow} bordered={false} options={{ defaultSortName: 'rssi', defaultSortOrder: 'desc' }} trClassName='valign'>
							<TableHeaderColumn dataField="addr" isKey={true} dataSort={true} className="hidden-xs" columnClassName="addr hidden-xs">Address</TableHeaderColumn>
							<TableHeaderColumn dataField="name" dataFormat={this.nameFormatter} dataSort={true} sortFunc={this.nameSort}>BLE Device Name</TableHeaderColumn>
							<TableHeaderColumn dataField="rssi" dataSort={true} dataAlign="right" width="17%" dataFormat={this.rssiFormatter}>RSSI</TableHeaderColumn>
							<TableHeaderColumn dataField="count" dataFormat={this.countFormatter} dataSort={true} dataAlign="right" className="hidden-xs" columnClassName="hidden-xs" width="17%">Count</TableHeaderColumn>
							<TableHeaderColumn dataField="tracked" dataSort={true} dataFormat={this.trackedFormatter} dataAlign="center" width="25%">Tracked</TableHeaderColumn>
						</BootstrapTable>
					</Col>
				</Row>
			</span>
		);
	}
}
