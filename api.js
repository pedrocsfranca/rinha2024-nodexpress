const express = require('express')
const app = express()
const mysql = require('mysql2')
const port = 9999;
app.use(express.json());

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'admin',
    database: 'rinha',
    port: '3306',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0

});

let operations = {
    findById: function(id) {
      return pool.promise().query('select * from cliente where id = ? for update', [id])
    },
    salvarTransacao: function(clientId, valor, tipo, descricao){
      return pool.promise().execute('insert into transacoes (cliente_id, valor, tipo, descricao) values (?,?,?,?)', [clientId,valor,tipo,descricao])
    },
    atualizarSaldo: function(clientId, novoSaldo){
        return pool.promise().execute('update cliente set saldo = ? where id = ?', [novoSaldo, clientId])
    },
    ultimasTransacoes: function(id){
      return pool.promise().query('select * from transacoes where cliente_id = ? for update', [id] )
    },
}

app.post("/clientes/:id/transacoes", async(req,res) => {
    let valorTransacao = req.body.valor
    let tipo = req.body.tipo
    let descricao = req.body.descricao
    let cliente_id = req.params.id
    let cliente;
    console.log(req.body)

    operations.findById(cliente_id).then((result)=> {
        cliente = result[0]
        const isValid = (valorTransacao, tipo, descricao, cliente_id) => {

            if (!isNaN(valorTransacao) &&
                Number.isInteger(Number(valorTransacao)) &&
                valorTransacao.toString().length !== 0) {
                if (tipo === "d" || tipo === "c") {
                    if (descricao !== null &&  descricao.length >= 1 && descricao.length < 10) {
                        if (cliente_id > 0 && cliente_id < 6) {
                            return true;
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                return false
            }
        };

        if (isValid(valorTransacao,tipo,descricao,cliente_id)){
            if (tipo === "d"){
                console.log('debito pay')
                debito = valorTransacao > cliente.saldo ? cliente.saldo - valorTransacao : 0;
                    if (debito + cliente.limite < 0 || cliente.limite + cliente.saldo === 0) {
                        res.sendStatus(422).end();
                        return
                    }
            } else { 
                
                debito = cliente.saldo - valorTransacao
            }


            operations.atualizarSaldo(cliente_id, debito).then((result)=> {
                console.log('Saldo Atualizado')
                operations.salvarTransacao(cliente_id, valorTransacao, tipo, descricao).then((result)=> {
                    console.log('Transacao Salva no Extrato')
                    res.sendStatus(200).end()
                    return
                }).catch(err => {
                    console.log(err)
                })
            }).catch(err => {
                console.log(err)
                
            })
            
        } else {
            res.sendStatus(422).end()
            return
        }



        }).catch((err)=> {
            console.log(err.message)

            
        })


    

    


})


app.get('/clientes/:id/extrato', async (req,res)=> {
    let cliente_id = req.params.id
    const dataReqExtrato = new Date().toISOString()


    function isValid (cliente_id) {
        if (cliente_id >= 1 && cliente_id <= 5){
            return true
        } else {
            res.sendStatus(404).end()
            return false
            
        }
    }

    if (isValid(cliente_id)) {
        console.log('caiu aqui vu')
        const [result] = await operations.findById(cliente_id);
        const cliente = result[0]
    
        const [resultTransacoes] = await operations.ultimasTransacoes(cliente_id)
        transacoes = resultTransacoes
        
    
        
    
    
        
        let resultado = {
    
            "saldo": {
                "total": cliente.saldo,
                "data_extrato": dataReqExtrato,
                "limite": cliente.limite
            }, 
            "ultimas_transacoes": transacoes.slice(-10)
        }
    
        res.json(resultado).end()
        return
    } 
})



app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});