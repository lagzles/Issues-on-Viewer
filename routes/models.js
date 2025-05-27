const express = require('express');
const formidable = require('express-formidable');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'composite-designs.csv');


const { listObjects, uploadObject, translateObject, getManifest, urnify, deleteObject } = require('../services/aps.js');

let router = express.Router();

router.get('/api/models', async function (req, res, next) {
    try {
        const objects = await listObjects();
        res.json(objects.map(o => ({
            name: o.objectKey,
            urn: urnify(o.objectId)
        })));
    } catch (err) {
        next(err);
    }
});

router.get('/api/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/models', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const obj = await uploadObject(file.name, file.path);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint']);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});


router.delete('/api/models/:urn', async (req, res) => {
    try {
        const urn = req.params.urn;
        const objectKey = urn;// Buffer.from(urn, 'base64').toString('utf8'); // reverso do "urnify"
        console.log(`Deleting object `);
        await deleteObject(objectKey);
        res.status(204).end();
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao excluir objeto');
    }
});

router.get('/api/issues', async(req, res) => {
    try{
        let issues = [
            {
                id: 1,
                name: 'Issue 1 - la primeira',
                description: 'This is the first issue.',
                status: 'Open',
                severity: 'High',
                location: 'Section A',
                createdAt: new Date('2023-10-01T10:00:00Z'),
                updatedAt: new Date('2023-10-02T12:00:00Z'),
                dueDate: new Date('2023-10-10T15:00:00Z'),
                assignee: 'John Doe',
            },
            {
                id: 2,
                name: 'Issue 2',
                description: 'This is the second issue.',
                status: 'Closed',
                severity: 'Medium',
                location: 'Section B',
                createdAt: new Date('2023-10-03T11:00:00Z'),
                updatedAt: new Date('2023-10-04T13:00:00Z'),
                dueDate: new Date('2023-10-12T16:00:00Z'),
                assignee: 'Jane Smith',
            },
            {
                id: 3,
                name: 'Issue 3',
                description: 'This is the third issue.',
                status: 'In Progress',
                severity: 'Low',
                location: 'Section C',
                createdAt: new Date('2023-10-05T14:00:00Z'),
                updatedAt: new Date('2023-10-06T17:00:00Z'),
                dueDate: new Date('2023-10-15T18:00:00Z'),
                assignee: 'Alice Johnson',
            },
            {
                id: 4,
                name: 'Issue 4',
                description: 'This is the fourth issue.',
                status: 'Open',
                severity: 'Critical',
                location: 'Section D',
                createdAt: new Date('2023-10-07T09:00:00Z'),
                updatedAt: new Date('2023-10-08T10:00:00Z'),
                dueDate: new Date('2023-10-20T11:00:00Z'),
                assignee: 'Bob Brown',
            },
            {
                id: 5,
                name: 'Issue 5',
                description: 'This is the fifth issue.',
                status: 'Resolved',
                severity: 'High',
                location: 'Section E',
                createdAt: new Date('2023-10-09T08:00:00Z'),
                updatedAt: new Date('2023-10-10T09:00:00Z'),
                dueDate: new Date('2023-10-25T12:00:00Z'),
                assignee: 'Charlie Davis',
            }
        ];

        res.json({
            issues: issues,
            status: 200,
        })

    }
    catch(error){
        console.error('Erro ao ler o arquivo CSV:', error);
        res.status(500).send('Erro ao obter issues');
        return;
    }
})




module.exports = router;