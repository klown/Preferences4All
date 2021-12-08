/*
 * Copyright 2020-2021 Inclusive Design Research Centre, OCAD University
 * All rights reserved.
 *
 * Licensed under the New BSD license. You may not use this file except in
 * compliance with this License.
 */
/* eslint-env node */

"use strict";

const fluid = require("infusion");
const jqUnit = require("node-jqunit");
const postgresdb = require("../src/dbOps/postgresOps.js");

require("../src/shared/driverUtils.js");
require("./shared/utilsDb.js");

jqUnit.module("PostgresDB request unit tests.");

fluid.registerNamespace("fluid.tests.dbOps");

jqUnit.test("Database request tests", async function () {
    jqUnit.expect(7);

    // Start the database
    const dbStatus = await fluid.personalData.dockerStartDatabase(fluid.tests.postgresContainer, fluid.tests.postgresImage, fluid.tests.dbConfig);
    jqUnit.assertTrue("The database has been started successfully", dbStatus);

    // Initiate the postgres handler and valid
    const postgresHandler = new postgresdb.PostgresRequest(fluid.tests.dbConfig);
    jqUnit.assertNotNull(postgresHandler, "Check database request object is non-null");
    jqUnit.assertNotNull(postgresHandler.pool, "Check database connection is non-null");

    // Run a SQL to find all databases
    const allDbs = await fluid.tests.dbOps.findAllDatabases(postgresHandler);
    // The query result should match what's tracked in the postgres handler
    fluid.tests.dbOps.testResults(allDbs, postgresHandler);

    // Run a SQL on a non-existent table and check the error is returned
    try {
        await fluid.tests.dbOps.checkNoSuchDatabase(postgresHandler);
    } catch (error) {
        jqUnit.assertEquals("An error should be returned when a SQL is executed on a non-existent table", error.message, "relation \"no_such_databasez\" does not exist");
    }

    fluid.tests.utils.finish(postgresHandler);

    // Stop the docker container for the database
    await fluid.personalData.dockerStopDatabase(fluid.tests.postgresContainer, dbStatus);
});

/**
 * Check postgresdb for all of the databases it contains.
 *
 * @param {Object} postgresHandler - The postgres hanedler.
 * @return {Promise} Results returned by the request.
 */
fluid.tests.dbOps.findAllDatabases = function (postgresHandler) {
    var result = postgresHandler.runSql("SELECT datname FROM pg_database");
    result.then(null, function (error) {
        fluid.log(JSON.stringify(error.message));
    });
    return result;
};

/**
 * Check postgresdb for a non-existent table.
 *
 * @param {Object} postgresHandler - The postgres hanedler.
 * @return {Promise} Results returned by the request.
 */
fluid.tests.dbOps.checkNoSuchDatabase = function (postgresHandler) {
    var result = postgresHandler.runSql("SELECT datname FROM no_such_databasez");
    result.then(null, function (error) {
        fluid.log(JSON.stringify(error.message));
    });
    return result;
};

/**
 * Compare the returned results and the information tracked in the postgres handler.
 *
 * @param {Object} results - The results returned by the postgres handler.
 * @param {Object} postgresHandler - The postgres hanedler.
 */
fluid.tests.dbOps.testResults = function (results, postgresHandler) {
    jqUnit.assertNotNull("Check for null query result", results);
    jqUnit.assertNotEquals("Check for empty query result", results.rowCount, 0);

    var ourDatabaseName = postgresHandler.options.database;
    var ourDatabase = fluid.find(results.rows, function (aDatabase) {
        if (aDatabase.datname === ourDatabaseName) {
            return aDatabase;
        }
    }, null);
    jqUnit.assertNotNull(ourDatabase, "Check for '" + ourDatabaseName + "'");
};