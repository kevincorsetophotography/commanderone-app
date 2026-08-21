# Privacy Policy

*Ultimo aggiornamento: 19 agosto 2026*

> **Nota per chi gestisce CommanderOne**: questo documento è una bozza tecnicamente accurata — descrive esattamente cosa fa il codice, con chi condivide dati e perché — ma **non sostituisce una revisione legale**. Resta da completare il campo tra `[parentesi quadre]` sull'hosting scelto (sezione 5.5) non appena si sceglie un provider; prima di pubblicarla fai comunque verificare il testo da chi si occupa di conformità GDPR/privacy nella tua giurisdizione, soprattutto se prevedi utenti minorenni o extra-UE.

## 1. Titolare del trattamento

CommanderOne è sviluppato e gestito da **Kevin Corseto**, contattabile all'indirizzo email **ckappa97@gmail.com**.

Questa informativa si applica all'app web CommanderOne (il "Servizio") e descrive quali dati raccogliamo, perché, con chi li condividiamo e quali diritti hai su di essi.

## 2. Cos'è CommanderOne

CommanderOne è un tracker sociale di partite Magic: The Gathering formato Commander, organizzato per gruppi di gioco indipendenti ("Gruppi"). Non è un prodotto ufficiale di Wizards of the Coast — vedi la sezione 9.

## 3. Dati che raccogliamo

### 3.1 Dati che ci fornisci direttamente

| Dato | Quando | Obbligatorio? |
|---|---|---|
| Username | Registrazione | Sì |
| Email | Registrazione | Sì — usata per verifica account e recupero password |
| Password | Registrazione | Sì — non la vediamo mai in chiaro: viene sottoposta a hash (bcrypt) prima di essere salvata |
| Avatar | Facoltativo, in qualsiasi momento | No — scegli una carta Magic esistente come immagine profilo; non carichi foto tue |
| Nome del Gruppo, mazzi, partite, commenti, reazioni, RSVP eventi | Uso normale dell'app | Solo se scegli di usare quella funzione |
| Domande al Judge Bot | Uso facoltativo | No |

### 3.2 Dati generati dall'uso del Servizio

Risultati delle partite, statistiche, achievement sbloccati e notifiche sono generati automaticamente in base a come usi il Servizio insieme al tuo Gruppo.

### 3.3 Dati tecnici

Indirizzo IP (usato solo per limitare tentativi di login/abusi — non salvato in modo permanente collegato al tuo profilo), timestamp di creazione/modifica dei contenuti.

### 3.4 Cosa NON raccogliamo

Non raccogliamo dati di pagamento (il Servizio non ha funzioni a pagamento), non tracciamo la tua posizione geografica, non usiamo cookie di profilazione pubblicitaria.

## 4. Come usiamo i tuoi dati

- **Fornire il Servizio**: creare il tuo account, farti accedere ai Gruppi di cui fai parte, mostrarti mazzi/partite/statistiche/eventi del tuo Gruppo.
- **Comunicazioni essenziali**: email di verifica indirizzo e di reset password. Non inviamo email di marketing.
- **Sicurezza**: limitare tentativi di accesso ripetuti, individuare abusi.
- **Judge Bot**: se fai una domanda al Judge Bot, il testo viene elaborato per fornirti una risposta (vedi sezione 5.3).

Base giuridica (GDPR art. 6): esecuzione del contratto d'uso del Servizio per i punti sopra; interesse legittimo per la sicurezza anti-abuso.

## 5. Con chi condividiamo i dati

Non vendiamo i tuoi dati a nessuno. Li condividiamo solo con i fornitori tecnici necessari a far funzionare il Servizio ("responsabili del trattamento"), e con gli altri membri del tuo Gruppo nella misura in cui la funzione è per natura condivisa (es. il tuo username è visibile ai membri del tuo Gruppo, non a estranei).

### 5.1 Altri membri del tuo Gruppo

Username, avatar, mazzi, partite, commenti, reazioni e domande al Judge Bot che pubblichi sono visibili agli altri membri del **tuo stesso Gruppo** — è la natura sociale del Servizio. Non sono visibili a membri di Gruppi diversi: l'isolamento tra Gruppi è un principio strutturale dell'architettura (vedi anche `CLAUDE.md` nel repository).

### 5.2 Resend (email transazionali)

Usiamo [Resend](https://resend.com) per inviare le email di verifica indirizzo e reset password. Resend riceve il tuo indirizzo email al solo scopo di recapitare queste email. Consulta la [privacy policy di Resend](https://resend.com/legal/privacy-policy).

### 5.3 Groq (Judge Bot)

Se usi il Judge Bot, la tua domanda (e, se rilevanti, nomi di carte ed eventuali estratti di regole ufficiali) viene inviata a [Groq](https://groq.com) per generare una risposta tramite modelli linguistici di intelligenza artificiale. Ti chiediamo di non includere dati personali tuoi o di altri nelle domande. Consulta la [privacy policy di Groq](https://groq.com/privacy-policy/).

Se il Judge Bot ha raggiunto il tetto giornaliero di utilizzo o l'IA non è disponibile, la tua domanda viene comunque risolta usando solo dati pubblici ufficiali (testo carte e regolamento) senza coinvolgere Groq.

### 5.4 Scryfall (dati e immagini delle carte Magic)

Per mostrare immagini e informazioni delle carte (inclusi gli avatar) interroghiamo l'API pubblica di [Scryfall](https://scryfall.com). Queste richieste contengono solo nomi/ID di carte, mai dati personali tuoi. Consulta i [termini Scryfall](https://scryfall.com/docs/terms).

### 5.5 Hosting

**[Da completare quando si sceglie il provider di hosting/database — es. Railway, Vercel — includendo dove si trovano fisicamente i server e, se fuori dallo Spazio Economico Europeo, le garanzie di trasferimento dati applicabili (es. clausole contrattuali standard).]**

### 5.6 Obblighi di legge

Potremmo condividere dati se richiesto dalla legge, da un'autorità competente, o per proteggere i diritti, la sicurezza e la proprietà di CommanderOne o dei suoi utenti.

## 6. Per quanto tempo conserviamo i dati

Conserviamo i tuoi dati finché il tuo account resta attivo. Se cancelli l'account (vedi sezione 7.3), i tuoi dati personali (username, email, password) vengono cancellati immediatamente. Fanno eccezione i dati che fanno parte dello **storico condiviso** di partite giocate con altri membri del tuo Gruppo (es. la tua partecipazione a una partita, il mazzo usato): per non alterare lo storico di chi ha giocato con te e non ha chiesto la cancellazione del proprio account, questi riferimenti vengono resi anonimi (riassegnati a un account "utente eliminato" senza dati identificativi) invece di essere cancellati insieme al resto.

## 7. I tuoi diritti

Se ti trovi nello Spazio Economico Europeo, nel Regno Unito o in una giurisdizione con diritti equivalenti, hai diritto a:

- **Accesso**: sapere quali dati abbiamo su di te.
- **Rettifica**: correggere dati inesatti (es. dalla pagina Account).
- **Cancellazione ("diritto all'oblio")**: cancellare il tuo account in autonomia in qualsiasi momento dalla pagina Account → Zona pericolosa, senza dover contattare nessuno. Vedi sezione 6 per cosa viene reso anonimo invece che cancellato, e perché.
- **Portabilità**: ricevere un export dei dati del tuo Gruppo in formato leggibile da macchina (JSON) — disponibile agli amministratori di Gruppo dalla sezione Admin.
- **Opposizione e limitazione**: opporti a un trattamento basato su interesse legittimo o chiederne la limitazione.
- **Reclamo**: presentare reclamo alla tua autorità di controllo (in Italia, il Garante per la Protezione dei Dati Personali — [www.garanteprivacy.it](https://www.garanteprivacy.it)).

Per esercitare un diritto non disponibile in autonomia nell'app, scrivi a **ckappa97@gmail.com**.

### 7.1 Se sei l'unico amministratore di un Gruppo

La cancellazione dell'account è bloccata se sei l'unico amministratore di un Gruppo con altri membri, finché non promuovi qualcun altro ad amministratore — altrimenti gli altri membri perderebbero la governance del Gruppo senza che nessuno gliel'abbia data esplicitamente. Se sei l'unico membro del Gruppo, invece, l'intero Gruppo viene cancellato insieme al tuo account.

## 8. Sicurezza

Le password sono sottoposte a hash (bcrypt) e non sono mai leggibili in chiaro, nemmeno da chi amministra il Servizio. Le sessioni usano token JWT con scadenza. Limitiamo il numero di tentativi di accesso per prevenire attacchi automatizzati. Nessun sistema è sicuro al 100%: se scopriamo una violazione che riguarda i tuoi dati, te lo comunicheremo secondo quanto richiesto dalla legge applicabile.

## 9. Rapporto con Wizards of the Coast

CommanderOne è un prodotto "Fan Content" non ufficiale, permesso dalla Fan Content Policy di Wizards of the Coast. Non è approvato né sostenuto da Wizards of the Coast. Wizards of the Coast non riceve né elabora i dati personali raccolti da questo Servizio.

## 10. Età minima

Il Servizio non è rivolto a bambini sotto i 13 anni. Se hai tra 13 e 16 anni (o l'età di consenso digitale prevista dal tuo Paese, se diversa), assicurati di avere il permesso di chi esercita la responsabilità genitoriale prima di creare un account.

## 11. Local storage (non usiamo cookie di tracciamento)

Il Servizio salva il token di accesso e il Gruppo attivo nel *local storage* del tuo browser — un meccanismo tecnico necessario per farti restare autenticato, non un cookie di tracciamento pubblicitario o di terze parti. Cancellandolo (es. svuotando i dati del sito dal browser) esegui automaticamente il logout.

## 12. Modifiche a questa informativa

Se aggiorniamo questa informativa in modo sostanziale, te lo segnaleremo nel Servizio prima che le modifiche diventino effettive.

## 13. Contatti

Per qualunque domanda su questa informativa o sui tuoi dati: **ckappa97@gmail.com**.
